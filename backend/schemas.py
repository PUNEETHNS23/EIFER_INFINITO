from pydantic import BaseModel
from typing import Optional, Any
from datetime import datetime

class TeamBase(BaseModel):
    sport_id: str
    name: str

class TeamCreate(TeamBase):
    squad: Optional[list[dict[str, Any]]] = None

class Team(TeamBase):
    id: int
    points: int
    is_disqualified: bool = False
    disqualification_reason: Optional[str] = None
    squad: Optional[list[dict[str, Any]]] = None
    class Config:
        from_attributes = True

class MatchBase(BaseModel):
    sport_id: str
    team1_id: int
    team2_id: int
    scheduled_time: datetime

class MatchCreate(MatchBase):
    score_detail: Optional[dict[str, Any]] = None

class MatchUpdate(BaseModel):
    score_t1: Optional[int] = None
    score_t2: Optional[int] = None
    status: Optional[str] = None
    score_detail: Optional[dict[str, Any]] = None

class Match(MatchBase):
    id: int
    score_t1: int
    score_t2: int
    status: str
    score_detail: Optional[dict[str, Any]] = None
    team1: Optional[str] = None
    team2: Optional[str] = None
    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

class AdminCreate(BaseModel):
    username: str
    password: str

class AdminUser(BaseModel):
    id: int
    username: str
    is_admin: bool
    class Config:
        from_attributes = True

class DisqualifyRequest(BaseModel):
    reason: str
