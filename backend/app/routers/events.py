from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_child
from app.models.child import Child
from app.models.event import Event
from app.models.event_correction import EventCorrection
from app.schemas.event import EventCreate, EventUpdate, EventResponse

router = APIRouter()


@router.get("/", response_model=list[EventResponse])
async def list_events(
    start: date | None = Query(None),
    end: date | None = Query(None),
    event_date: date | None = Query(None),
    current_child: Child = Depends(get_current_child),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Event).where(Event.child_id == current_child.id).order_by(Event.event_date)
    if event_date:
        stmt = stmt.where(Event.event_date == event_date)
    elif start and end:
        stmt = stmt.where(Event.event_date >= start, Event.event_date <= end)
    result = await db.execute(stmt)
    return [EventResponse.model_validate(e) for e in result.scalars().all()]


@router.post("/", response_model=EventResponse, status_code=201)
async def create_event(
    body: EventCreate,
    current_child: Child = Depends(get_current_child),
    db: AsyncSession = Depends(get_db),
):
    event = Event(**body.model_dump(), child_id=current_child.id)
    db.add(event)
    await db.commit()
    await db.refresh(event)
    return EventResponse.model_validate(event)


@router.patch("/{event_id}", response_model=EventResponse)
async def update_event(
    event_id: int,
    body: EventUpdate,
    current_child: Child = Depends(get_current_child),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Event).where(Event.id == event_id, Event.child_id == current_child.id)
    )
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    original_title = event.title
    original_date = str(event.event_date)

    updates = body.model_dump(exclude_none=True)
    for field, value in updates.items():
        setattr(event, field, value)

    title_changed = "title" in updates and updates["title"] != original_title
    date_changed = "event_date" in updates and str(updates["event_date"]) != original_date

    if title_changed or date_changed:
        correction = EventCorrection(
            event_id=event.id,
            child_id=current_child.id,
            source_message=event.source_message,
            original_title=original_title if title_changed else None,
            corrected_title=updates["title"] if title_changed else None,
            original_date=original_date if date_changed else None,
            corrected_date=str(updates["event_date"]) if date_changed else None,
        )
        db.add(correction)

    await db.commit()
    await db.refresh(event)
    return EventResponse.model_validate(event)


@router.delete("/{event_id}", status_code=204)
async def delete_event(
    event_id: int,
    current_child: Child = Depends(get_current_child),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Event).where(Event.id == event_id, Event.child_id == current_child.id)
    )
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    await db.delete(event)
    await db.commit()
