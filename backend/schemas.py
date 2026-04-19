from pydantic import BaseModel, Field
from typing import Optional, Any
from datetime import datetime

class TeamBase(BaseModel):
    sport_id: str
    name: str
    category: Optional[str] = None

class TeamCreate(TeamBase):
    squad: Optional[list[dict[str, Any]]] = None

class Team(TeamBase):
    id: int
    points: int
    is_disqualified: bool = False
    disqualification_reason: Optional[str] = None
    squad: Optional[list[dict[str, Any]]] = None
    results: Optional[dict[str, Any]] = None
    class Config:
        from_attributes = True

class OverallLeaderboardEntry(BaseModel):
    name: str
    points: int
    sports: list[str] = Field(default_factory=list)
    team_ids: list[int] = Field(default_factory=list)

    class Config:
        from_attributes = True

class MatchBase(BaseModel):
    sport_id: str
    team1_id: int
    team2_id: int
    scheduled_time: Optional[datetime] = None

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


# ── Athletics Leaderboard ────────────────────────────────────────────────────

class AthleticsEntry(BaseModel):
    id: Optional[str] = None
    team_name: str
    players: list[str] = []
    time_sec: float
    is_disqualified: bool = False

class AthleticsEventCreate(BaseModel):
    event_type: str   # relay_4x100 | boys_100m | girls_100m
    label: Optional[str] = None


class LeaderboardRematchScore(BaseModel):
    entry_id: str
    final_score: float


class LeaderboardRematchResolveRequest(BaseModel):
    rank: int
    results: list[LeaderboardRematchScore]

class AthleticsEventOut(BaseModel):
    id: int
    event_type: str
    label: Optional[str] = None
    status: str
    entries: Optional[list[dict[str, Any]]] = None
    finalized_at: Optional[datetime] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ── Weight Lifting Leaderboard ───────────────────────────────────────────────

class WLAttempts(BaseModel):
    """3 attempts for one lift category (kg). 0 means not attempted / failed."""
    a1: float = 0.0
    a2: float = 0.0
    a3: float = 0.0

class WeightLiftingEntry(BaseModel):
    id: Optional[str] = None
    name: str
    squat: list[float] = [0.0, 0.0, 0.0]          # 3 attempts
    bench_press: list[float] = [0.0, 0.0, 0.0]    # 3 attempts
    dead_lift: list[float] = [0.0, 0.0, 0.0]      # 3 attempts
    is_disqualified: bool = False

class WeightLiftingEventCreate(BaseModel):
    label: Optional[str] = None

class WeightLiftingEventOut(BaseModel):
    id: int
    label: Optional[str] = None
    status: str
    entries: Optional[list[dict[str, Any]]] = None
    finalized_at: Optional[datetime] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class WeightLiftingBulkUpdate(BaseModel):
    updates: list[WeightLiftingEntry]


# ── Tournament Bracket ────────────────────────────────────────────────────────

class TournamentCreate(BaseModel):
    sport_id:  str
    name:      str
    category:  Optional[str] = None
    team_ids:  list[int]

class TournamentSetWinner(BaseModel):
    match_uid:   str
    winner_id:   int
    winner_name: str

class TournamentSetDetails(BaseModel):
    match_uid:    str
    scheduled_at: Optional[str] = None   # ISO datetime string or null
    venue:        Optional[str] = None
    teamA_id:     Optional[int] = None   # Manual team override for slot A
    teamB_id:     Optional[int] = None   # Manual team override for slot B

class TournamentBulkSetDetails(BaseModel):
    updates: list[TournamentSetDetails]


class TournamentSwapTeams(BaseModel):
    match_uid_src: str
    team_key_src:  str   # "teamA" or "teamB"
    match_uid_tgt: str
    team_key_tgt:  str   # "teamA" or "teamB"


class TournamentOut(BaseModel):
    id:        int
    sport_id:  str
    name:      str
    category:  Optional[str] = None
    status:    str
    bracket:   Optional[list] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True
