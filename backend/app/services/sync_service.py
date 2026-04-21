import logging
from datetime import datetime

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.child import Child
from app.models.planner import PlannerEntry
from app.models.bag import BagItem
from app.models.event import Event
from app.services import whatsapp_service, ollama_service
from app.config import get_settings

logger = logging.getLogger(__name__)


async def sync_child(child: Child, db: AsyncSession) -> dict:
    if not child.whatsapp_group_id:
        return {"skipped": True, "reason": "no_group_configured"}

    since = int(child.last_synced_at.timestamp()) if child.last_synced_at else None

    try:
        messages = await whatsapp_service.get_group_messages(
            child.whatsapp_group_id, since=since
        )
    except Exception as e:
        logger.error("WhatsApp fetch failed for child %d: %s", child.id, e)
        return {"error": str(e), "parsed": 0}

    parsed_count = 0
    events_added = 0
    errors = []

    filter_keyword = get_settings().whatsapp.message_filter.lower()

    for msg in messages:
        body = msg.get("body", "")
        try:
            parsed = await ollama_service.parse_whatsapp_message(body)
        except Exception as e:
            errors.append(str(e))
            continue

        # Replace existing entries for this date+child (idempotent)
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

    # Parse non-planner messages for events if enabled
    if child.parse_events:
        try:
            all_messages = await whatsapp_service.get_all_group_messages(
                child.whatsapp_group_id, since=since
            )
        except Exception as e:
            logger.error("WhatsApp fetch (all) failed for child %d: %s", child.id, e)
            all_messages = []

        non_planner = [
            m for m in all_messages
            if filter_keyword not in (m.get("body") or "").lower()
        ]
        for msg in non_planner:
            body = (msg.get("body") or "").strip()
            if not body:
                continue
            try:
                ev = await ollama_service.parse_event_from_message(body, msg.get("timestamp"))
            except Exception as e:
                logger.warning("Event parse error for child %d: %s", child.id, e)
                continue
            if not ev:
                continue
            # Skip if an event with the same title+date already exists for this child
            existing = await db.execute(
                select(Event).where(
                    Event.child_id == child.id,
                    Event.title == ev.title,
                    Event.event_date == ev.event_date,
                )
            )
            if existing.scalar_one_or_none():
                continue

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
            ))
            events_added += 1
            logger.info("Event added for child %d: %s on %s", child.id, ev.title, ev.event_date)

    child.last_synced_at = datetime.utcnow()
    await db.commit()

    return {
        "parsed": parsed_count,
        "messages_found": len(messages),
        "events_added": events_added,
        "errors": errors,
    }
