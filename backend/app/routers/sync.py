import json
import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.database import get_db
from app.models.child import Child
from app.models.event import Event
from app.models.whatsapp_message import WaMessage
from app.dependencies import get_current_child
from app.services import sync_service
from app.core.security import decode_token
from app.config import get_settings

logger = logging.getLogger(__name__)
router = APIRouter()


class SyncStatusResponse(BaseModel):
    last_synced_at: str | None
    whatsapp_group_name: str | None
    auto_sync: bool
    sync_interval_minutes: int


@router.post("/trigger")
async def trigger_sync(
    current_child: Child = Depends(get_current_child),
    db: AsyncSession = Depends(get_db),
):
    result = await sync_service.sync_child(current_child, db)
    return result


@router.get("/stream")
async def stream_sync(
    token: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    """SSE endpoint — streams sync progress. Token passed as query param (EventSource limitation)."""
    child_id = decode_token(token, get_settings().auth.secret_key)
    if not child_id:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    result = await db.execute(select(Child).where(Child.id == child_id))
    child = result.scalar_one_or_none()
    if not child:
        raise HTTPException(status_code=401, detail="Child not found")

    async def event_stream():
        try:
            async for update in sync_service.sync_child_streaming(child, db):
                yield f"data: {json.dumps(update)}\n\n"
        except Exception as e:
            logger.error("Streaming sync error for child %d: %s", child.id, e)
            yield f"data: {json.dumps({'stage': 'done', 'error': str(e), 'parsed': 0, 'events_added': 0})}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # disables Nginx proxy buffering for this response
        },
    )


@router.post("/purge")
async def purge_sync_data(
    current_child: Child = Depends(get_current_child),
    db: AsyncSession = Depends(get_db),
):
    """Clears the message-seen cache and all auto-detected events so the next sync reprocesses everything."""
    await db.execute(delete(WaMessage).where(WaMessage.child_id == current_child.id))
    await db.execute(
        delete(Event).where(
            Event.child_id == current_child.id,
            Event.source_message != None,  # noqa: E711 — SQLAlchemy IS NOT NULL
        )
    )
    await db.commit()
    return {"ok": True, "message": "Sync cache cleared. Next sync will reprocess all messages."}


@router.get("/status", response_model=SyncStatusResponse)
async def sync_status(current_child: Child = Depends(get_current_child)):
    return SyncStatusResponse(
        last_synced_at=current_child.last_synced_at.isoformat() if current_child.last_synced_at else None,
        whatsapp_group_name=current_child.whatsapp_group_name,
        auto_sync=current_child.auto_sync,
        sync_interval_minutes=current_child.sync_interval_minutes,
    )
