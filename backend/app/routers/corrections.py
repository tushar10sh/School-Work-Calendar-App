from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_child
from app.models.child import Child
from app.models.event_correction import EventCorrection
from app.schemas.event import EventCorrectionResponse

router = APIRouter()


@router.get("/", response_model=list[EventCorrectionResponse])
async def list_corrections(
    current_child: Child = Depends(get_current_child),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(EventCorrection)
        .where(EventCorrection.child_id == current_child.id)
        .order_by(EventCorrection.corrected_at.desc())
    )
    return [EventCorrectionResponse.model_validate(c) for c in result.scalars().all()]
