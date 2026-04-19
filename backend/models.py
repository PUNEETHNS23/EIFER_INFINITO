from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, DateTime, JSON, Text
from sqlalchemy.orm import relationship
import datetime

from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    is_admin = Column(Boolean, default=False)

class Team(Base):
    __tablename__ = "teams"

    id = Column(Integer, primary_key=True, index=True)
    sport_id = Column(String, index=True)
    name = Column(String, index=True)
    category = Column(String, nullable=True)
    points = Column(Integer, default=0)
    is_disqualified = Column(Boolean, default=False)
    disqualification_reason = Column(String, default=None, nullable=True)
    squad = Column(JSON, nullable=True)
    results = Column(JSON, nullable=True) # { "max_lift": 0.0, "is_injured": false }

class Match(Base):
    __tablename__ = "matches"

    id = Column(Integer, primary_key=True, index=True)
    sport_id = Column(String, index=True)
    team1_id = Column(Integer, ForeignKey("teams.id"))
    team2_id = Column(Integer, ForeignKey("teams.id"))
    score_t1 = Column(Integer, default=0)
    score_t2 = Column(Integer, default=0)
    score_detail = Column(JSON, nullable=True)
    status = Column(String, default="upcoming") # upcoming, live, completed
    scheduled_time = Column(DateTime, default=datetime.datetime.utcnow)

    team1 = relationship("Team", foreign_keys=[team1_id])
    team2 = relationship("Team", foreign_keys=[team2_id])


class AthleticsEvent(Base):
    __tablename__ = "athletics_events"

    id = Column(Integer, primary_key=True, index=True)
    # relay_4x100 | boys_100m | girls_100m
    event_type = Column(String, index=True, nullable=False)
    label = Column(String, nullable=True)           # human-readable name e.g. "Heat 1" or "Final"
    status = Column(String, default="upcoming")     # upcoming | completed
    entries = Column(JSON, nullable=True)           # list of entry dicts (see below)
    finalized_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class WeightLiftingEvent(Base):
    __tablename__ = "weightlifting_events"

    id = Column(Integer, primary_key=True, index=True)
    label = Column(String, nullable=True)           # e.g. "Men's Open", "Final"
    status = Column(String, default="upcoming")     # upcoming | completed
    # Each entry: { id, name, squat:[a1,a2,a3], bench:[a1,a2,a3], dead_lift:[a1,a2,a3],
    #               squat_best, bench_best, dead_lift_best, total, is_disqualified }
    entries = Column(JSON, nullable=True)
    finalized_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class Tournament(Base):
    __tablename__ = "tournaments"

    id          = Column(Integer, primary_key=True, index=True)
    sport_id    = Column(String, index=True)
    name        = Column(String)
    category    = Column(String, nullable=True)
    status      = Column(String, default="active")  # active | completed
    is_public   = Column(Boolean, default=True, nullable=False)
    # Full bracket: list of rounds, each round = list of match dicts
    # match dict keys: uid, round, position, teamA, teamB, winner, match_id, scheduled_at
    bracket     = Column(JSON, nullable=True)
    created_at  = Column(DateTime, default=datetime.datetime.utcnow)
