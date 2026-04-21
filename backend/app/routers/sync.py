from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.database import get_db
from app.models.child import Child
from app.dependencies import get_current_child
from app.services import sync_service
from app.schemas.child import ChildResponse

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


@router.get("/status", response_model=SyncStatusResponse)
async def sync_status(current_child: Child = Depends(get_current_child)):
    return SyncStatusResponse(
        last_synced_at=current_child.last_synced_at.isoformat() if current_child.last_synced_at else None,
        whatsapp_group_name=current_child.whatsapp_group_name,
        auto_sync=current_child.auto_sync,
        sync_interval_minutes=current_child.sync_interval_minutes,
    )
