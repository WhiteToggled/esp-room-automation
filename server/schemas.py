from datetime import datetime
from typing import Dict, List, Optional

from pydantic import BaseModel, field_validator

from config import VALID_DAYS


class ToggleResponse(BaseModel):
    id: str
    new_state: int


class StateLogEntry(BaseModel):
    id: int
    logged_at: datetime
    snapshot: Dict[str, int]

    class Config:
        from_attributes = True


class LogBucket(BaseModel):
    bucket_start: datetime
    avg_on: float
    peak_on: int
    total: int
    samples: int


class UserCreate(BaseModel):
    username: str
    password: str
    rooms: List[str] = []


class UserRoomsUpdate(BaseModel):
    rooms: List[str]


class ScheduleResponse(BaseModel):
    id: int
    device_id: str
    action: int
    hour: int
    minute: int
    days: List[str]
    enabled: bool
    created_by: str
    created_at: datetime

    class Config:
        from_attributes = True


class ScheduleCreate(BaseModel):
    device_id: str
    action: int
    hour: int
    minute: int
    days: List[str]
    enabled: bool = True

    @field_validator("action")
    @classmethod
    def action_must_be_binary(cls, v):
        if v not in (0, 1):
            raise ValueError("action must be 0 or 1")
        return v

    @field_validator("hour")
    @classmethod
    def hour_range(cls, v):
        if not 0 <= v <= 23:
            raise ValueError("hour must be 0–23")
        return v

    @field_validator("minute")
    @classmethod
    def minute_range(cls, v):
        if not 0 <= v <= 59:
            raise ValueError("minute must be 0–59")
        return v

    @field_validator("days")
    @classmethod
    def days_valid(cls, v):
        normalized = [d.lower() for d in v]
        invalid = [d for d in normalized if d not in VALID_DAYS]
        if invalid:
            raise ValueError(f"Invalid days: {invalid}. Valid: mon,tue,wed,thu,fri,sat,sun")
        if not normalized:
            raise ValueError("At least one day must be specified")
        return normalized


class ScheduleUpdate(BaseModel):
    action: Optional[int] = None
    hour: Optional[int] = None
    minute: Optional[int] = None
    days: Optional[List[str]] = None
    enabled: Optional[bool] = None

    @field_validator("action")
    @classmethod
    def action_must_be_binary(cls, v):
        if v is not None and v not in (0, 1):
            raise ValueError("action must be 0 or 1")
        return v

    @field_validator("hour")
    @classmethod
    def hour_range(cls, v):
        if v is not None and not 0 <= v <= 23:
            raise ValueError("hour must be 0–23")
        return v

    @field_validator("minute")
    @classmethod
    def minute_range(cls, v):
        if v is not None and not 0 <= v <= 59:
            raise ValueError("minute must be 0–59")
        return v

    @field_validator("days")
    @classmethod
    def days_valid(cls, v):
        if v is None:
            return v
        normalized = [d.lower() for d in v]
        invalid = [d for d in normalized if d not in VALID_DAYS]
        if invalid:
            raise ValueError(f"Invalid days: {invalid}. Valid: mon,tue,wed,thu,fri,sat,sun")
        if not normalized:
            raise ValueError("At least one day must be specified")
        return normalized
