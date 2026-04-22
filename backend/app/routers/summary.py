from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_child
from app.models.child import Child
from app.models.planner import PlannerEntry
from app.models.event import Event
from app.models.todo import Todo

router = APIRouter()


@router.get("/")
async def get_summary(
    start: date = Query(...),
    end: date = Query(...),
    current_child: Child = Depends(get_current_child),
    db: AsyncSession = Depends(get_db),
):
    entries_result = await db.execute(
        select(PlannerEntry.section, PlannerEntry.is_completed).where(
            PlannerEntry.child_id == current_child.id,
            PlannerEntry.date >= start,
            PlannerEntry.date <= end,
        )
    )
    entries = entries_result.all()
    cw = [e for e in entries if e.section == "CW"]
    pw = [e for e in entries if e.section == "PW"]

    events_result = await db.execute(
        select(Event.action_taken).where(
            Event.child_id == current_child.id,
            Event.event_date >= start,
            Event.event_date <= end,
            Event.is_archived == False,
        )
    )
    events = events_result.all()

    todos_result = await db.execute(
        select(Todo.is_completed).where(
            Todo.child_id == current_child.id,
            Todo.is_archived == False,
        )
    )
    todos = todos_result.all()

    return {
        "period": {"start": start.isoformat(), "end": end.isoformat()},
        "classwork": {
            "total": len(cw),
            "completed": sum(1 for e in cw if e.is_completed),
        },
        "homework": {
            "total": len(pw),
            "completed": sum(1 for e in pw if e.is_completed),
        },
        "events": {
            "total": len(events),
            "action_taken": sum(1 for e in events if e.action_taken),
        },
        "todos": {
            "total": len(todos),
            "completed": sum(1 for t in todos if t.is_completed),
        },
    }
