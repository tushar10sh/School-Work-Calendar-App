import asyncio
import json
import re
import logging
from datetime import date

import httpx
from pydantic import ValidationError

from app.config import get_settings
from app.schemas.planner import ParsedOllamaResult

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
