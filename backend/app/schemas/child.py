from datetime import datetime
from pydantic import BaseModel, ConfigDict, field_validator


class ChildCreate(BaseModel):
    name: str
    pin: str
    color: str = "#3b82f6"
    sync_interval_minutes: int = 60
    auto_sync: bool = True

    @field_validator("pin")
    @classmethod
    def pin_length(cls, v):
        if len(v) < 4:
            raise ValueError("PIN must be at least 4 characters")
        return v


class ChildUpdate(BaseModel):
    name: str | None = None
    color: str | None = None
    whatsapp_group_id: str | None = None
    whatsapp_group_name: str | None = None
    sync_interval_minutes: int | None = None
    auto_sync: bool | None = None
    parse_events: bool | None = None


class ChildResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    color: str
    whatsapp_group_id: str | None
    whatsapp_group_name: str | None
    last_synced_at: datetime | None
    sync_interval_minutes: int
    auto_sync: bool
    parse_events: bool
    created_at: datetime


class LoginRequest(BaseModel):
    child_id: int
    pin: str


class LoginResponse(BaseModel):
    token: str
    child: ChildResponse
