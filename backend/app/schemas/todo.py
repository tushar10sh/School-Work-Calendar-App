from datetime import date, datetime
from typing import Literal
from pydantic import BaseModel, ConfigDict

Priority = Literal["HIGH", "MEDIUM", "LOW"]


class TodoCreate(BaseModel):
    title: str
    description: str | None = None
    due_date: date | None = None
    priority: Priority = "MEDIUM"


class TodoUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    due_date: date | None = None
    is_completed: bool | None = None
    priority: Priority | None = None
    is_archived: bool | None = None


class TodoResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: str | None
    due_date: date | None
    is_completed: bool
    priority: str
    is_archived: bool = False
    created_at: datetime
