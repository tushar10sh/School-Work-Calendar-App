from datetime import date, datetime
from typing import Literal
from pydantic import BaseModel, ConfigDict


class ParseRequest(BaseModel):
    message: str


class SubjectEntry(BaseModel):
    subject_code: str
    subject_name: str
    task: str


class ParsedOllamaResult(BaseModel):
    date: date
    classwork: list[SubjectEntry] = []
    homework: list[SubjectEntry] = []
    bag_items: list[str] = []


class PlannerEntryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    date: date
    section: Literal["CW", "PW"]
    subject_code: str
    subject_name: str
    task: str
    is_completed: bool
    created_at: datetime


class PlannerEntryUpdate(BaseModel):
    is_completed: bool | None = None
    task: str | None = None


class BagItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    date: date
    item: str
    created_at: datetime


class DayDetailResponse(BaseModel):
    date: date
    classwork: list[PlannerEntryResponse]
    homework: list[PlannerEntryResponse]
    bag_items: list[BagItemResponse]


class ParseResponse(DayDetailResponse):
    parsed_at: datetime


class CalendarDotInfo(BaseModel):
    has_cw: bool
    has_pw: bool
    entry_count: int
    has_events: bool = False
    has_tests: bool = False
