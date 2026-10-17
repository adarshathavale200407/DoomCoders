from typing import Literal, Optional

from pydantic import BaseModel, EmailStr, Field

CategoryKey = Literal["pothole", "water_leak", "garbage", "streetlight", "other"]
TeamName = Literal["Roads", "Water", "Sanitation", "Electricity"]
WorkStatus = Literal["assigned", "in_progress", "resolved"]


class RegisterIn(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class IssueIn(BaseModel):
    title: str = Field(min_length=3, max_length=120)
    description: str = Field(min_length=5, max_length=2000)
    category: CategoryKey
    severity: int = Field(default=3, ge=1, le=5)
    photo_url: Optional[str] = Field(default=None, max_length=1000)
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)
    address: Optional[str] = Field(default=None, max_length=300)


class DuplicateCheckIn(BaseModel):
    category: CategoryKey
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)
    title: str = ""
    description: str = ""


class AssignIn(BaseModel):
    team: TeamName


class StatusIn(BaseModel):
    status: WorkStatus
    note: Optional[str] = Field(default=None, max_length=500)


class MergeIn(BaseModel):
    duplicate_of: str
