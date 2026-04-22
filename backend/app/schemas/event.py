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
    action_taken: bool | None = None
    is_archived: bool | None = None


class EventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: str | None
    event_date: date
    event_type: str
    color: str
    action_taken: bool = False
    is_archived: bool = False
    source_message: str | None = None
    source_timestamp: int | None = None
    source_sender: str | None = None
    created_at: datetime


class EventCorrectionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    event_id: int | None
    source_message: str | None
    original_title: str | None
    corrected_title: str | None
    original_date: str | None
    corrected_date: str | None
    corrected_at: datetime
