import asyncio
import json
import re
import logging
from datetime import date, datetime
from typing import Optional

import httpx
from pydantic import BaseModel, ValidationError

from app.config import get_settings
from app.schemas.planner import ParsedOllamaResult


class ParsedEventResult(BaseModel):
    is_event: bool
    title: Optional[str] = None
    description: Optional[str] = None
    event_date: Optional[date] = None
    event_type: str = "OTHER"

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are a school planner parser. Parse the WhatsApp message and return ONLY valid JSON with no explanation, no markdown, no code fences.

Rules:
- date: convert DD.MM.YY to YYYY-MM-DD (year prefix is 20, so 26 = 2026)
- classwork: entries under the "Cw"/"CW" section header
- homework: entries under the "Pw"/"PW" section header
- bag_items: items listed after "My bag-"
- Each entry has: subject_code (original abbreviation), subject_name (full name from mappings), task (description)
- If a subject code is not in the mappings, use the code itself as subject_name

Return exactly this JSON structure:
{"date":"YYYY-MM-DD","classwork":[{"subject_code":"X","subject_name":"Full Name","task":"description"}],"homework":[{"subject_code":"X","subject_name":"Full Name","task":"description"}],"bag_items":["item1","item2"]}"""


def _strip_fences(text: str) -> str:
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\s*```$", "", text)
    return text.strip()


def _extract_json(text: str) -> str:
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        return match.group(0)
    return text


async def parse_whatsapp_message(message: str) -> ParsedOllamaResult:
    settings = get_settings()
    mappings_hint = ", ".join(
        f"{k}={v}" for k, v in settings.subjects.mappings.items()
    )

    full_prompt = (
        f"{SYSTEM_PROMPT}\n\nSubject code mappings: {mappings_hint}\n\nMessage:\n{message}"
    )

    payload = {
        "model": settings.ollama.model,
        "prompt": full_prompt,
        "stream": False,
        "format": "json",
    }

    last_error = None
    async with httpx.AsyncClient(timeout=settings.ollama.timeout) as client:
        for attempt in range(3):
            try:
                response = await client.post(
                    f"{settings.ollama.base_url}/api/generate",
                    json=payload,
                )
                response.raise_for_status()
                raw_text = response.json().get("response", "")
                logger.debug("Ollama raw response: %s", raw_text[:500])

                cleaned = _strip_fences(raw_text)
                cleaned = _extract_json(cleaned)

                parsed = json.loads(cleaned)
                result = ParsedOllamaResult(**parsed)

                # Validate year is sane (2020-2035)
                if not (2020 <= result.date.year <= 2035):
                    raise ValueError(f"Parsed year {result.date.year} looks wrong")

                # Case-insensitive subject name resolution — overrides whatever the
                # LLM returned with the canonical full name from config.
                ci_mappings = {k.upper(): v for k, v in settings.subjects.mappings.items()}
                for entry in result.classwork + result.homework:
                    resolved = ci_mappings.get(entry.subject_code.strip().upper())
                    if resolved:
                        entry.subject_name = resolved

                return result

            except (json.JSONDecodeError, ValidationError, ValueError, KeyError) as e:
                last_error = e
                logger.warning("Ollama parse attempt %d failed: %s", attempt + 1, e)
                if attempt < 2:
                    await asyncio.sleep(2 ** attempt)
            except httpx.HTTPError as e:
                last_error = e
                logger.warning("Ollama HTTP error attempt %d: %s", attempt + 1, e)
                if attempt < 2:
                    await asyncio.sleep(2 ** attempt)

    raise RuntimeError(
        f"Failed to parse message after 3 attempts. Last error: {last_error}"
    )


def _title_in_message(title: str, body: str) -> bool:
    """Sanity check: at least one significant word from the LLM title must appear in body."""
    significant = [w.lower() for w in title.split() if len(w) > 3]
    if not significant:
        return True
    body_lower = body.lower()
    return any(w in body_lower for w in significant)


def _build_event_prompt(message: str, message_date: str) -> str:
    return f"""You are a school communication parser. This message was sent on {message_date}.

Analyze the WhatsApp message below. Decide if it describes an actionable event, activity, or deadline for parents or children.

INCLUDE as events:
- Parent-teacher meetings or school meetings
- School trips, sports days, cultural programs, special activities
- Requests to submit, sign, or return forms, fees, or permission slips by a date
- Requests to send back something on a specific day (e.g. "send it back on Monday")
- Any message where a parent or child must act by a named day or date

RESOLVE relative dates from the message date ({message_date}):
- "Monday" or "this Monday" → the nearest Monday on or after {message_date}
- "by Friday" → nearest Friday on or after {message_date}
- "next week" → 7 days after {message_date}

EXCLUDE:
- Routine daily classwork or homework (those belong in the daily planner)
- Announcements with no required action or no date
- Planner-format messages (containing Cw/Pw sections)

event_type must be exactly one of: SCHOOL_EVENT, PARENT_MEETING, OTHER

Return ONLY valid JSON — nothing else:
If an event: {{"is_event":true,"title":"concise title under 60 chars","description":"full context from the message","event_date":"YYYY-MM-DD","event_type":"SCHOOL_EVENT|PARENT_MEETING|OTHER"}}
If not an event: {{"is_event":false}}

Message:
{message}"""


async def parse_event_from_message(message: str, message_timestamp: int | None = None) -> Optional[ParsedEventResult]:
    settings = get_settings()
    if message_timestamp:
        message_date = datetime.utcfromtimestamp(message_timestamp).strftime("%Y-%m-%d")
    else:
        message_date = datetime.utcnow().strftime("%Y-%m-%d")
    full_prompt = _build_event_prompt(message, message_date)

    try:
        async with httpx.AsyncClient(timeout=settings.ollama.timeout) as client:
            response = await client.post(
                f"{settings.ollama.base_url}/api/generate",
                json={"model": settings.ollama.model, "prompt": full_prompt, "stream": False, "format": "json"},
            )
            response.raise_for_status()
            raw_text = response.json().get("response", "")
            cleaned = _extract_json(_strip_fences(raw_text))
            parsed = json.loads(cleaned)
            result = ParsedEventResult(**parsed)
            if not result.is_event or not result.event_date or not result.title:
                return None
            if not _title_in_message(result.title, message):
                logger.warning(
                    "Hallucination guard rejected event '%s' — title words absent from source message",
                    result.title,
                )
                return None
            return result
    except Exception as e:
        logger.warning("Event parse failed: %s", e)
        return None
