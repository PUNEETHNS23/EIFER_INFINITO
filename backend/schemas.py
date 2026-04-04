from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class TeamBase(BaseModel):
    sport_id: str
    name: str

class TeamCreate(TeamBase):
    pass

class Team(TeamBase):
    id: int
    points: int
    is_disqualified: bool = False
    disqualification_reason: str | None = None
    class Config:
        from_attributes = True

class MatchBase(BaseModel):
    sport_id: str
    team1_id: int
    team2_id: int
    scheduled_time: datetime

class MatchCreate(MatchBase):
    pass

class MatchUpdate(BaseModel):
    score_t1: int
    score_t2: int
    status: str

class Match(MatchBase):
    id: int
    score_t1: int
    score_t2: int
    status: str
    team1: str = None
    team2: str = None
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
