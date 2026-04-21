from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, case
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_child
from app.models.child import Child
from app.models.todo import Todo
from app.schemas.todo import TodoCreate, TodoUpdate, TodoResponse

router = APIRouter()

PRIORITY_ORDER = case(
    (Todo.priority == "HIGH", 0),
    (Todo.priority == "MEDIUM", 1),
    (Todo.priority == "LOW", 2),
    else_=3,
)


@router.get("/", response_model=list[TodoResponse])
async def list_todos(
    completed: bool | None = Query(None),
    current_child: Child = Depends(get_current_child),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(Todo)
        .where(Todo.child_id == current_child.id)
        .order_by(Todo.is_completed, PRIORITY_ORDER, Todo.due_date.asc().nulls_last())
    )
    if completed is not None:
        stmt = stmt.where(Todo.is_completed == completed)
    result = await db.execute(stmt)
    return [TodoResponse.model_validate(t) for t in result.scalars().all()]


@router.post("/", response_model=TodoResponse, status_code=201)
async def create_todo(
    body: TodoCreate,
    current_child: Child = Depends(get_current_child),
    db: AsyncSession = Depends(get_db),
):
    todo = Todo(**body.model_dump(), child_id=current_child.id)
    db.add(todo)
    await db.commit()
    await db.refresh(todo)
    return TodoResponse.model_validate(todo)


@router.patch("/{todo_id}", response_model=TodoResponse)
async def update_todo(
    todo_id: int,
    body: TodoUpdate,
    current_child: Child = Depends(get_current_child),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Todo).where(Todo.id == todo_id, Todo.child_id == current_child.id)
    )
    todo = result.scalar_one_or_none()
    if not todo:
        raise HTTPException(status_code=404, detail="Todo not found")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(todo, field, value)
    await db.commit()
    await db.refresh(todo)
    return TodoResponse.model_validate(todo)


@router.delete("/{todo_id}", status_code=204)
async def delete_todo(
    todo_id: int,
    current_child: Child = Depends(get_current_child),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Todo).where(Todo.id == todo_id, Todo.child_id == current_child.id)
    )
    todo = result.scalar_one_or_none()
    if not todo:
        raise HTTPException(status_code=404, detail="Todo not found")
    await db.delete(todo)
    await db.commit()
