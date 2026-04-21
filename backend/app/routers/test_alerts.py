import json
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_child
from app.models.child import Child
from app.models.test_alert import TestAlert
from app.schemas.test_alert import TestAlertCreate, TestAlertUpdate, TestAlertResponse

router = APIRouter()


@router.get("/", response_model=list[TestAlertResponse])
async def list_test_alerts(
    upcoming: bool | None = Query(None),
    current_child: Child = Depends(get_current_child),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(TestAlert)
        .where(TestAlert.child_id == current_child.id)
        .order_by(TestAlert.test_date)
    )
    if upcoming:
        stmt = stmt.where(TestAlert.test_date >= date.today())
    result = await db.execute(stmt)
    return [TestAlertResponse.model_validate(t) for t in result.scalars().all()]


@router.post("/", response_model=TestAlertResponse, status_code=201)
async def create_test_alert(
    body: TestAlertCreate,
    current_child: Child = Depends(get_current_child),
    db: AsyncSession = Depends(get_db),
):
    data = body.model_dump()
    data["topics"] = json.dumps(data.get("topics", []))
    alert = TestAlert(**data, child_id=current_child.id)
    db.add(alert)
    await db.commit()
    await db.refresh(alert)
    return TestAlertResponse.model_validate(alert)


@router.patch("/{alert_id}", response_model=TestAlertResponse)
async def update_test_alert(
    alert_id: int,
    body: TestAlertUpdate,
    current_child: Child = Depends(get_current_child),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(TestAlert).where(
            TestAlert.id == alert_id, TestAlert.child_id == current_child.id
        )
    )
    alert = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=404, detail="Test alert not found")
    data = body.model_dump(exclude_none=True)
    if "topics" in data:
        data["topics"] = json.dumps(data["topics"])
    for field, value in data.items():
        setattr(alert, field, value)
    await db.commit()
    await db.refresh(alert)
    return TestAlertResponse.model_validate(alert)


@router.delete("/{alert_id}", status_code=204)
async def delete_test_alert(
    alert_id: int,
    current_child: Child = Depends(get_current_child),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(TestAlert).where(
            TestAlert.id == alert_id, TestAlert.child_id == current_child.id
        )
    )
    alert = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=404, detail="Test alert not found")
    await db.delete(alert)
    await db.commit()
