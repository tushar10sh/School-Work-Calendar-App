import logging
from datetime import datetime

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.child import Child
from app.models.planner import PlannerEntry
from app.models.bag import BagItem
from app.services import whatsapp_service, ollama_service

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
    errors = []

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

    child.last_synced_at = datetime.utcnow()
    await db.commit()

    return {"parsed": parsed_count, "messages_found": len(messages), "errors": errors}
