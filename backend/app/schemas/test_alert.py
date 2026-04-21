from datetime import date, datetime
from typing import Literal
from pydantic import BaseModel, ConfigDict, field_validator, field_serializer
import json

TestType = Literal["UNIT_TEST", "EXAM", "ASSESSMENT", "QUIZ"]


class TestAlertCreate(BaseModel):
    subject: str
    subject_name: str
    test_date: date
    topics: list[str] = []
    test_type: TestType = "UNIT_TEST"
    notes: str | None = None


class TestAlertUpdate(BaseModel):
    subject: str | None = None
    subject_name: str | None = None
    test_date: date | None = None
    topics: list[str] | None = None
    test_type: TestType | None = None
    notes: str | None = None


class TestAlertResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    subject: str
    subject_name: str
    test_date: date
    topics: list[str]
    test_type: str
    notes: str | None
    created_at: datetime

    @field_validator("topics", mode="before")
    @classmethod
    def parse_topics(cls, v):
        if isinstance(v, str):
            try:
                return json.loads(v)
            except (json.JSONDecodeError, TypeError):
                return []
        return v or []
