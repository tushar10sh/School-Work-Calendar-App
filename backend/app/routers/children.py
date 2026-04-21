from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.child import Child
from app.schemas.child import ChildCreate, ChildUpdate, ChildResponse
from app.core.security import hash_pin
from app.dependencies import get_current_child

router = APIRouter()


@router.get("/", response_model=list[ChildResponse])
async def list_children(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Child).order_by(Child.created_at))
    return [ChildResponse.model_validate(c) for c in result.scalars().all()]


@router.post("/", response_model=ChildResponse, status_code=201)
async def create_child(body: ChildCreate, db: AsyncSession = Depends(get_db)):
    child = Child(
        name=body.name,
        pin_hash=hash_pin(body.pin),
        color=body.color,
        sync_interval_minutes=body.sync_interval_minutes,
        auto_sync=body.auto_sync,
    )
    db.add(child)
    await db.commit()
    await db.refresh(child)
    return ChildResponse.model_validate(child)


@router.patch("/{child_id}", response_model=ChildResponse)
async def update_child(
    child_id: int,
    body: ChildUpdate,
    current_child: Child = Depends(get_current_child),
    db: AsyncSession = Depends(get_db),
):
    if current_child.id != child_id:
        raise HTTPException(status_code=403, detail="Cannot update another child's profile")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(current_child, field, value)
    await db.commit()
    await db.refresh(current_child)
    return ChildResponse.model_validate(current_child)


@router.delete("/{child_id}", status_code=204)
async def delete_child(
    child_id: int,
    current_child: Child = Depends(get_current_child),
    db: AsyncSession = Depends(get_db),
):
    if current_child.id != child_id:
        raise HTTPException(status_code=403, detail="Cannot delete another child's profile")
    result = await db.execute(select(Child).where(Child.id == child_id))
    child = result.scalar_one_or_none()
    if not child:
        raise HTTPException(status_code=404, detail="Not found")
    await db.delete(child)
    await db.commit()
