import logging
from datetime import datetime
from typing import AsyncGenerator

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.child import Child
from app.models.planner import PlannerEntry
from app.models.bag import BagItem
from app.models.event import Event
from app.models.whatsapp_message import WaMessage
from app.services import whatsapp_service, ollama_service
from app.config import get_settings

logger = logging.getLogger(__name__)


async def sync_child_streaming(child: Child, db: AsyncSession) -> AsyncGenerator[dict, None]:
    """Yields progress dicts; final yield has stage='done' with summary."""
    if not child.whatsapp_group_id:
        yield {"stage": "done", "skipped": True, "reason": "no_group_configured", "parsed": 0, "events_added": 0}
        return

    since = int(child.last_synced_at.timestamp()) if child.last_synced_at else None
    filter_keyword = get_settings().whatsapp.message_filter.lower()

    # ── Fetch planner messages ──────────────────────────────────────────────
    yield {"stage": "fetching", "message": "Fetching messages…"}
    try:
        messages = await whatsapp_service.get_group_messages(child.whatsapp_group_id, since=since)
    except Exception as e:
        logger.error("WhatsApp fetch failed for child %d: %s", child.id, e)
        yield {"stage": "done", "error": str(e), "parsed": 0, "events_added": 0}
        return

    parsed_count = 0
    events_added = 0
    errors = []

    # ── Planner pass ───────────────────────────────────────────────────────
    total_planner = len(messages)
    yield {"stage": "planner", "done": 0, "total": total_planner}

    for i, msg in enumerate(messages):
        body = msg.get("body", "")
        try:
            parsed = await ollama_service.parse_whatsapp_message(body)
        except Exception as e:
            errors.append(str(e))
            yield {"stage": "planner", "done": i + 1, "total": total_planner}
            continue

        await db.execute(
            delete(PlannerEntry).where(
                PlannerEntry.child_id == child.id,
                PlannerEntry.date == parsed.date,
            )
        )
        await db.execute(
            delete(BagItem).where(
                BagItem.child_id == child.id,
                BagItem.date == parsed.date,
            )
        )
        for item in parsed.classwork:
            db.add(PlannerEntry(
                child_id=child.id, date=parsed.date, section="CW",
                subject_code=item.subject_code, subject_name=item.subject_name,
                task=item.task,
            ))
        for item in parsed.homework:
            db.add(PlannerEntry(
                child_id=child.id, date=parsed.date, section="PW",
                subject_code=item.subject_code, subject_name=item.subject_name,
                task=item.task,
            ))
        for item_name in parsed.bag_items:
            db.add(BagItem(child_id=child.id, date=parsed.date, item=item_name.strip()))

        parsed_count += 1
        yield {"stage": "planner", "done": i + 1, "total": total_planner}

    # ── Event pass ─────────────────────────────────────────────────────────
    if child.parse_events:
        yield {"stage": "events_fetching", "message": "Fetching messages for event scan…"}
        try:
            all_messages = await whatsapp_service.get_all_group_messages(
                child.whatsapp_group_id, since=None
            )
        except Exception as e:
            logger.error("WhatsApp fetch (all) failed for child %d: %s", child.id, e)
            all_messages = []

        existing_rows = await db.execute(
            select(WaMessage.wa_msg_id).where(WaMessage.child_id == child.id)
        )
        seen_ids: set[str] = {row[0] for row in existing_rows.fetchall()}

        non_planner = [
            m for m in all_messages
            if filter_keyword not in (m.get("body") or "").lower()
        ]
        new_messages = [
            m for m in non_planner
            if m.get("id") and m.get("id") not in seen_ids and (m.get("body") or "").strip()
        ]

        total_events = len(new_messages)
        yield {"stage": "events", "done": 0, "total": total_events}

        for i, msg in enumerate(new_messages):
            wa_msg_id = msg.get("id")
            body = (msg.get("body") or "").strip()

            try:
                ev = await ollama_service.parse_event_from_message(body, msg.get("timestamp"))
            except Exception as e:
                logger.warning("Event parse error for child %d: %s", child.id, e)
                ev = None

            sender = (msg.get("author") or msg.get("from") or "").split("@")[0]
            db.add(WaMessage(
                child_id=child.id,
                wa_msg_id=wa_msg_id,
                body=body[:5000],
                timestamp=msg.get("timestamp"),
                sender=sender or None,
            ))
            seen_ids.add(wa_msg_id)

            if ev:
                existing_event = await db.execute(
                    select(Event).where(
                        Event.child_id == child.id,
                        Event.title == ev.title,
                        Event.event_date == ev.event_date,
                    )
                )
                if not existing_event.scalar_one_or_none():
                    color = {"SCHOOL_EVENT": "#10b981", "PARENT_MEETING": "#3b82f6"}.get(
                        ev.event_type, "#f59e0b"
                    )
                    db.add(Event(
                        child_id=child.id,
                        title=ev.title,
                        description=ev.description,
                        event_date=ev.event_date,
                        event_type=ev.event_type,
                        color=color,
                        source_message=body,
                        source_timestamp=msg.get("timestamp"),
                        source_sender=sender or None,
                    ))
                    events_added += 1
                    logger.info("Event added for child %d: %s on %s", child.id, ev.title, ev.event_date)

            yield {"stage": "events", "done": i + 1, "total": total_events}

    child.last_synced_at = datetime.utcnow()
    await db.commit()

    yield {
        "stage": "done",
        "parsed": parsed_count,
        "messages_found": len(messages),
        "events_added": events_added,
        "errors": errors,
    }


async def sync_child(child: Child, db: AsyncSession) -> dict:
    """Blocking wrapper around sync_child_streaming for the scheduler."""
    result = {}
    async for update in sync_child_streaming(child, db):
        if update.get("stage") == "done":
            result = update
    return result
