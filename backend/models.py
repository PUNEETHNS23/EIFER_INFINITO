from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, DateTime, JSON
from sqlalchemy.orm import relationship
import datetime

from .database import Base

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
