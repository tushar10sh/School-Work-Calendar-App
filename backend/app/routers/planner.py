from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_child
from app.models.child import Child
from app.models.planner import PlannerEntry
from app.models.bag import BagItem
from app.models.event import Event
from app.models.test_alert import TestAlert
from app.schemas.planner import (
    ParseRequest,
    ParseResponse,
    DayDetailResponse,
    PlannerEntryResponse,
    BagItemResponse,
    CalendarDotInfo,
)
from app.services import ollama_service

router = APIRouter()


@router.post("/parse", response_model=ParseResponse)
async def parse_message(
    body: ParseRequest,
    replace: bool = Query(True),
    current_child: Child = Depends(get_current_child),
    db: AsyncSession = Depends(get_db),
):
    try:
        parsed = await ollama_service.parse_whatsapp_message(body.message)
    except RuntimeError as e:
        raise HTTPException(status_code=422, detail=str(e))

    if replace:
        await db.execute(
            delete(PlannerEntry).where(
                PlannerEntry.child_id == current_child.id,
                PlannerEntry.date == parsed.date,
            )
        )
        await db.execute(
            delete(BagItem).where(
                BagItem.child_id == current_child.id,
                BagItem.date == parsed.date,
            )
        )

    cw_entries = []
    for item in parsed.classwork:
        entry = PlannerEntry(
            child_id=current_child.id, date=parsed.date, section="CW",
            subject_code=item.subject_code, subject_name=item.subject_name, task=item.task,
        )
        db.add(entry)
        cw_entries.append(entry)

    pw_entries = []
    for item in parsed.homework:
        entry = PlannerEntry(
            child_id=current_child.id, date=parsed.date, section="PW",
            subject_code=item.subject_code, subject_name=item.subject_name, task=item.task,
        )
        db.add(entry)
        pw_entries.append(entry)

    bag_items = []
    for item_name in parsed.bag_items:
        bag = BagItem(child_id=current_child.id, date=parsed.date, item=item_name.strip())
        db.add(bag)
        bag_items.append(bag)

    await db.commit()
    for e in cw_entries + pw_entries:
        await db.refresh(e)
    for b in bag_items:
        await db.refresh(b)

    return ParseResponse(
        date=parsed.date,
        classwork=[PlannerEntryResponse.model_validate(e) for e in cw_entries],
        homework=[PlannerEntryResponse.model_validate(e) for e in pw_entries],
        bag_items=[BagItemResponse.model_validate(b) for b in bag_items],
        parsed_at=datetime.utcnow(),
    )


@router.get("/range", response_model=dict[str, CalendarDotInfo])
async def get_range(
    start: date = Query(...),
    end: date = Query(...),
    current_child: Child = Depends(get_current_child),
    db: AsyncSession = Depends(get_db),
):
    entries_result = await db.execute(
        select(PlannerEntry.date, PlannerEntry.section)
        .where(
            PlannerEntry.child_id == current_child.id,
            PlannerEntry.date >= start,
            PlannerEntry.date <= end,
        )
    )
    entries = entries_result.all()

    event_dates = {
        str(r.event_date)
        for r in (
            await db.execute(
                select(Event.event_date).where(
                    Event.child_id == current_child.id,
                    Event.event_date >= start,
                    Event.event_date <= end,
                )
            )
        ).all()
    }

    test_dates = {
        str(r.test_date)
        for r in (
            await db.execute(
                select(TestAlert.test_date).where(
                    TestAlert.child_id == current_child.id,
                    TestAlert.test_date >= start,
                    TestAlert.test_date <= end,
                )
            )
        ).all()
    }

    result: dict[str, CalendarDotInfo] = {}
    for entry_date, section in entries:
        key = str(entry_date)
        if key not in result:
            result[key] = CalendarDotInfo(
                has_cw=False, has_pw=False, entry_count=0,
                has_events=key in event_dates, has_tests=key in test_dates,
            )
        if section == "CW":
            result[key].has_cw = True
        elif section == "PW":
            result[key].has_pw = True
        result[key].entry_count += 1

    for d in event_dates | test_dates:
        if d not in result:
            result[d] = CalendarDotInfo(
                has_cw=False, has_pw=False, entry_count=0,
                has_events=d in event_dates, has_tests=d in test_dates,
            )

    return result


@router.get("/{entry_date}", response_model=DayDetailResponse)
async def get_day(
    entry_date: date,
    current_child: Child = Depends(get_current_child),
    db: AsyncSession = Depends(get_db),
):
    entries_result = await db.execute(
        select(PlannerEntry)
        .where(PlannerEntry.child_id == current_child.id, PlannerEntry.date == entry_date)
        .order_by(PlannerEntry.section, PlannerEntry.id)
    )
    entries = entries_result.scalars().all()

    bags_result = await db.execute(
        select(BagItem)
        .where(BagItem.child_id == current_child.id, BagItem.date == entry_date)
        .order_by(BagItem.id)
    )
    bags = bags_result.scalars().all()

    return DayDetailResponse(
        date=entry_date,
        classwork=[PlannerEntryResponse.model_validate(e) for e in entries if e.section == "CW"],
        homework=[PlannerEntryResponse.model_validate(e) for e in entries if e.section == "PW"],
        bag_items=[BagItemResponse.model_validate(b) for b in bags],
    )


@router.patch("/{entry_id}/complete", response_model=PlannerEntryResponse)
async def toggle_complete(
    entry_id: int,
    current_child: Child = Depends(get_current_child),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(PlannerEntry).where(
            PlannerEntry.id == entry_id,
            PlannerEntry.child_id == current_child.id,
        )
    )
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    entry.is_completed = not entry.is_completed
    await db.commit()
    await db.refresh(entry)
    return PlannerEntryResponse.model_validate(entry)


@router.delete("/{entry_id}", status_code=204)
async def delete_entry(
    entry_id: int,
    current_child: Child = Depends(get_current_child),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(PlannerEntry).where(
            PlannerEntry.id == entry_id,
            PlannerEntry.child_id == current_child.id,
        )
    )
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    await db.delete(entry)
    await db.commit()
