from datetime import date, datetime
from typing import Literal
from pydantic import BaseModel, ConfigDict

EventType = Literal["HOLIDAY", "SCHOOL_EVENT", "PARENT_MEETING", "OTHER"]


class EventCreate(BaseModel):
    title: str
    description: str | None = None
    event_date: date
    event_type: EventType = "OTHER"
    color: str = "#10b981"


class EventUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    event_date: date | None = None
    event_type: EventType | None = None
    color: str | None = None


class EventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: str | None
    event_date: date
    event_type: str
    color: str
    created_at: datetime
