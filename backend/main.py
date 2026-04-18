import os
import uuid
from pathlib import Path
from typing import Optional, Any
from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parent
load_dotenv(BACKEND_DIR / ".env")

from fastapi import FastAPI, Depends, HTTPException, status, WebSocket, WebSocketDisconnect
from fastapi.encoders import jsonable_encoder
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from sqlalchemy.engine.url import make_url
from datetime import datetime, timedelta

from sqlalchemy import inspect, text, String, cast
from . import models, schemas, database, auth, scoring


def _db_target_string(url: str) -> str:
    try:
        parsed = make_url(url)
        if parsed.drivername.startswith("sqlite"):
            return f"{parsed.drivername}:///{parsed.database or ''}"
        return f"{parsed.drivername}://{parsed.host}:{parsed.port}/{parsed.database}"
    except Exception:
        return "unparseable DATABASE_URL"


print(f"[DB] Target: {_db_target_string(database.SQLALCHEMY_DATABASE_URL)}")

models.Base.metadata.create_all(bind=database.engine)


def ensure_db_migrations():
    insp = inspect(database.engine)
    tables = insp.get_table_names()
    
    if "matches" in tables:
        cols = {c["name"] for c in insp.get_columns("matches")}
        if "score_detail" not in cols:
            with database.engine.begin() as conn:
                conn.execute(text("ALTER TABLE matches ADD COLUMN score_detail TEXT"))
                
    if "teams" in tables:
        cols = {c["name"] for c in insp.get_columns("teams")}
        if "squad" not in cols:
            with database.engine.begin() as conn:
                conn.execute(text("ALTER TABLE teams ADD COLUMN squad TEXT"))
        if "category" not in cols:
            with database.engine.begin() as conn:
                conn.execute(text("ALTER TABLE teams ADD COLUMN category TEXT"))
        if "results" not in cols:
            with database.engine.begin() as conn:
                conn.execute(text("ALTER TABLE teams ADD COLUMN results JSON"))


ensure_db_migrations()

app = FastAPI(title="SportsFest INFINITO API")

class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast_json(self, data: dict):
        payload = jsonable_encoder(data)
        stale_connections = []
        for connection in self.active_connections:
            try:
                await connection.send_json(payload)
            except Exception:
                stale_connections.append(connection)
        for connection in stale_connections:
            self.disconnect(connection)

manager = ConnectionManager()

@app.websocket("/api/ws/matches")
async def websocket_matches(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)

cors_origins_str = os.environ.get("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000")
origins = [origin.strip() for origin in cors_origins_str.split(",") if origin.strip()]
cors_origin_regex = os.environ.get("CORS_ORIGIN_REGEX", "").strip() or None

# Browsers reject wildcard origin with credentials, so force credentials off in that case.
cors_allow_credentials = os.environ.get("CORS_ALLOW_CREDENTIALS", "false").lower() == "true"
if "*" in origins:
    cors_allow_credentials = False

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=cors_origin_regex,
    allow_credentials=cors_allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Dependency
def get_db():
    db = database.SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --- INIT DEFAULT ADMIN ---
@app.on_event("startup")
def startup_event():
    db = database.SessionLocal()
    admin = db.query(models.User).filter(models.User.username == "admin").first()
    if not admin:
        hashed_pw = auth.get_password_hash("admin") # default pw
        db.add(models.User(username="admin", hashed_password=hashed_pw, is_admin=True))
        db.commit()
    _sync_leaderboard_points()
    db.close()

# --- AUTH ROUTES ---
@app.post("/api/auth/token", response_model=schemas.Token)
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == form_data.username).first()
    if not user or not auth.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth.create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

# --- ADMIN MANAGEMENT ROUTES ---
@app.get("/api/admins", response_model=list[schemas.AdminUser])
def get_admins(db: Session = Depends(get_db), current_user: str = Depends(auth.verify_token)):
    return db.query(models.User).filter(models.User.is_admin == True).all()

@app.post("/api/admins", response_model=schemas.AdminUser)
def create_admin(admin_data: schemas.AdminCreate, db: Session = Depends(get_db), current_user: str = Depends(auth.verify_token)):
    existing = db.query(models.User).filter(models.User.username == admin_data.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")
    hashed_pw = auth.get_password_hash(admin_data.password)
    new_admin = models.User(username=admin_data.username, hashed_password=hashed_pw, is_admin=True)
    db.add(new_admin)
    db.commit()
    db.refresh(new_admin)
    return new_admin

@app.delete("/api/admins/{admin_id}")
def delete_admin(admin_id: int, db: Session = Depends(get_db), current_user: str = Depends(auth.verify_token)):
    admin = db.query(models.User).filter(models.User.id == admin_id).first()
    if not admin:
        raise HTTPException(status_code=404, detail="Admin not found")
    if admin.username == "admin":
        raise HTTPException(status_code=400, detail="Cannot delete the root admin account")
    db.delete(admin)
    db.commit()
    return {"detail": "Admin removed"}

# --- TEAM ROUTES ---
@app.get("/api/teams", response_model=list[schemas.Team])
def get_teams(db: Session = Depends(get_db)):
    return db.query(models.Team).all()

@app.get("/api/teams/sport/{sport_id}", response_model=list[schemas.Team])
def get_teams_by_sport(sport_id: str, db: Session = Depends(get_db)):
    return db.query(models.Team).filter(models.Team.sport_id == sport_id).all()

def _normalize_team_key(name: str) -> str:
    return " ".join((name or "").split()).casefold()


@app.get("/api/leaderboard/overall", response_model=list[schemas.OverallLeaderboardEntry])
def get_overall_leaderboard(db: Session = Depends(get_db)):
    grouped: dict[str, dict[str, Any]] = {}

    for team in db.query(models.Team).all():
        display_name = (team.name or "").strip() or "Unknown"
        key = _normalize_team_key(display_name)
        entry = grouped.setdefault(
            key,
            {
                "name": display_name,
                "points": 0,
                "sports": [],
                "team_ids": [],
            },
        )

        entry["points"] += int(team.points or 0)
        entry["team_ids"].append(team.id)
        if team.sport_id and team.sport_id not in entry["sports"]:
            entry["sports"].append(team.sport_id)
        if entry["name"] == "Unknown" and display_name != "Unknown":
            entry["name"] = display_name

    leaderboard = sorted(
        grouped.values(),
        key=lambda row: (-row["points"], row["name"].casefold()),
    )
    return leaderboard

@app.post("/api/teams", response_model=schemas.Team)
def create_team(team: schemas.TeamCreate, db: Session = Depends(get_db), current_user: str = Depends(auth.verify_token)):
    racket_categories = {
        "Mens Singles",
        "Mens Doubles",
        "Womens Singles",
        "Womens Doubles",
        "Mixed Doubles",
    }

    if team.sport_id in {"badminton", "table-tennis"}:
        category = (team.category or "").strip()
        if category not in racket_categories:
            raise HTTPException(status_code=400, detail="Badminton/Table Tennis teams require a valid category.")
        team.category = category

        squad = team.squad or []
    # SQUAD VALIDATION RULES ENGINE
    sport_id = team.sport_id
    category = (team.category or "").strip()
    squad = team.squad or []
    
    # Pre-process squad
    normalized_squad = []
    for player in squad:
        p_dict = dict(player)
        p_dict["name"] = (player.get("name") or "").strip()
        normalized_squad.append(p_dict)
    
    player_names = [p["name"] for p in normalized_squad if p["name"]]
    if any(not name for name in player_names):
        raise HTTPException(status_code=400, detail="Player names cannot be empty.")
    if len(set(player_names)) != len(player_names):
        raise HTTPException(status_code=400, detail="Player names must be unique within the team.")
    
    mains = [p for p in normalized_squad if not p.get("is_substitute")]
    subs  = [p for p in normalized_squad if p.get("is_substitute")]
    
    limit_main = 99
    limit_sub = 0
    
    if sport_id == "football":
        limit_main, limit_sub = 6, 3
    elif sport_id == "volleyball":
        limit_main, limit_sub = 6, 3
    elif sport_id == "kho-kho":
        limit_main, limit_sub = 9, 3
    elif sport_id == "cricket":
        limit_main, limit_sub = 11, 3
    elif sport_id in ["weight-lifting", "arm-wrestling"]:
        limit_main, limit_sub = 1, 0
    elif sport_id == "tug-of-war":
        limit_main, limit_sub = 99, 0
    elif sport_id in ["badminton", "table-tennis"]:
        limit_main, limit_sub = (2 if "Doubles" in category or "Mixed" in category else 1), 0
    elif sport_id == "carrom":
        limit_main, limit_sub = (2 if "Doubles" in category else 1), 0
    elif sport_id == "chess":
        limit_main, limit_sub = {"Rapid": 4, "Hand & Brain": 2, "Blitz": 1}.get(category, 1), 0
    elif sport_id == "athletics":
        limit_main, limit_sub = (4 if "4 X 100" in category else 1), 0
    
    if len(mains) > limit_main:
        raise HTTPException(status_code=400, detail=f"{sport_id} {category} allows at most {limit_main} main players.")
    if len(subs) > limit_sub:
        raise HTTPException(status_code=400, detail=f"{sport_id} {category} allows at most {limit_sub} substitutes.")
    if sport_id in ["badminton", "table-tennis", "chess", "carrom", "weight-lifting", "arm-wrestling", "athletics", "kho-kho", "volleyball", "cricket"]:
        if len(mains) != limit_main:
             raise HTTPException(status_code=400, detail=f"{sport_id} {category} requires exactly {limit_main} player(s).")

    team.squad = normalized_squad
    team.category = category

    db_team = models.Team(**team.model_dump())
    db.add(db_team)
    db.commit()
    db.refresh(db_team)
    return db_team

@app.delete("/api/teams/{team_id}")
def delete_team(team_id: int, db: Session = Depends(get_db), current_user: str = Depends(auth.verify_token)):
    team = db.query(models.Team).filter(models.Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    linked_match = db.query(models.Match).filter(
        (models.Match.team1_id == team_id) | (models.Match.team2_id == team_id)
    ).first()
    if linked_match:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete team that is linked to existing matches. Delete those matches first.",
        )
    db.delete(team)
    db.commit()
    return {"detail": "Team deleted"}

@app.put("/api/teams/{team_id}/results", response_model=schemas.Team)
def update_team_results(
    team_id: int,
    results: dict[str, Any],
    db: Session = Depends(get_db),
    current_user: str = Depends(auth.verify_token)
):
    team = db.query(models.Team).filter(models.Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    # For powerlifting/weight-lifting, auto-calculate the total
    if team.sport_id == "weight-lifting":
        squat = float(results.get("squat") or 0)
        bench = float(results.get("bench") or 0)
        deadlift = float(results.get("deadlift") or 0)
        results["squat"] = squat
        results["bench"] = bench
        results["deadlift"] = deadlift
        results["total"] = squat + bench + deadlift
        results["is_injured"] = bool(results.get("is_injured", False))
        results["is_disqualified"] = bool(results.get("is_disqualified", False))

    from sqlalchemy.orm.attributes import flag_modified
    team.results = results
    flag_modified(team, "results")
    db.commit()
    db.refresh(team)
    return team

@app.put("/api/teams/{team_id}/disqualify", response_model=schemas.Team)
def disqualify_team(team_id: int, req: schemas.DisqualifyRequest, db: Session = Depends(get_db), current_user: str = Depends(auth.verify_token)):
    team = db.query(models.Team).filter(models.Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    team.is_disqualified = True
    team.disqualification_reason = req.reason
    db.commit()
    db.refresh(team)
    return team

@app.put("/api/teams/{team_id}/reinstate", response_model=schemas.Team)
def reinstate_team(team_id: int, db: Session = Depends(get_db), current_user: str = Depends(auth.verify_token)):
    team = db.query(models.Team).filter(models.Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    team.is_disqualified = False
    team.disqualification_reason = None
    db.commit()
    db.refresh(team)
    return team

# --- MATCH ROUTES ---
def map_match_names(m, db):
    t1 = db.query(models.Team).filter(models.Team.id == m.team1_id).first()
    t2 = db.query(models.Team).filter(models.Team.id == m.team2_id).first()
    return {
        "id": m.id,
        "sport_id": m.sport_id,
        "team1_id": m.team1_id,
        "team2_id": m.team2_id,
        "scheduled_time": m.scheduled_time,
        "score_t1": m.score_t1,
        "score_t2": m.score_t2,
        "status": m.status,
        "score_detail": m.score_detail,
        "team1": t1.name if t1 else "Unknown",
        "team2": t2.name if t2 else "Unknown",
    }


def _should_count_for_leaderboard(sport_id: str) -> bool:
    return True

def _apply_match_points(db: Session, team1_id: int, team2_id: int, score_t1: int, score_t2: int):
    t1 = db.query(models.Team).filter(models.Team.id == team1_id).first()
    t2 = db.query(models.Team).filter(models.Team.id == team2_id).first()
    if not t1 or not t2:
        return

    if score_t1 > score_t2:
        t1.points += 2
    elif score_t2 > score_t1:
        t2.points += 2
    else:
        t1.points += 1
        t2.points += 1


def _recalculate_leaderboard_points(db: Session):
    for team in db.query(models.Team).all():
        team.points = 0

    completed_matches = db.query(models.Match).filter(models.Match.status == "completed").all()
    for match in completed_matches:
        if _should_count_for_leaderboard(match.sport_id):
            _apply_match_points(db, match.team1_id, match.team2_id, match.score_t1, match.score_t2)


def _sync_leaderboard_points():
    db = database.SessionLocal()
    try:
        _recalculate_leaderboard_points(db)
        db.commit()
    finally:
        db.close()


def _reverse_match_points(db: Session, team1_id: int, team2_id: int, score_t1: int, score_t2: int):
    t1 = db.query(models.Team).filter(models.Team.id == team1_id).first()
    t2 = db.query(models.Team).filter(models.Team.id == team2_id).first()
    if not t1 or not t2:
        return

    if score_t1 > score_t2:
        t1.points = max(0, t1.points - 2)
    elif score_t2 > score_t1:
        t2.points = max(0, t2.points - 2)
    else:
        t1.points = max(0, t1.points - 1)
        t2.points = max(0, t2.points - 1)


def _apply_athletics_points(db: Session, detail: Optional[dict]):
    if not detail or not detail.get("is_final"):
        return
    participants = detail.get("participants", [])
    for p in participants:
        rank = _as_int(p.get("rank"))
        team_id = p.get("team_id")
        if rank and team_id:
            team = db.query(models.Team).filter(models.Team.id == team_id).first()
            if team:
                if rank == 1: team.points += 5
                elif rank == 2: team.points += 3
                elif rank == 3: team.points += 1


def _reverse_athletics_points(db: Session, detail: Optional[dict]):
    if not detail or not detail.get("is_final"):
        return
    participants = detail.get("participants", [])
    for p in participants:
        rank = _as_int(p.get("rank"))
        team_id = p.get("team_id")
        if rank and team_id:
            team = db.query(models.Team).filter(models.Team.id == team_id).first()
            if team:
                if rank == 1: team.points = max(0, team.points - 5)
                elif rank == 2: team.points = max(0, team.points - 3)
                elif rank == 3: team.points = max(0, team.points - 1)


def _as_int(v: Any, default: int = 0) -> int:
    try:
        return int(v)
    except (TypeError, ValueError):
        return default


def _team_player_names(team: Optional[models.Team]) -> list[str]:
    squad = getattr(team, "squad", None) or []
    names: list[str] = []
    seen: set[str] = set()

    for player in squad:
        if not isinstance(player, dict):
            continue
        name = (player.get("name") or "").strip()
        if not name or name in seen:
            continue
        seen.add(name)
        names.append(name)

    return names


def _apply_racket_lineup(detail: dict[str, Any], team: Optional[models.Team], prefix: str, category: str):
    if not team:
        return

    names = _team_player_names(team)
    if not names:
        return

    is_doubles = isinstance(category, str) and "Doubles" in category
    primary_key = f"{prefix}_name"
    partner_key = f"{prefix}_partner"

    detail[primary_key] = (detail.get(primary_key) or names[0]).strip()
    if is_doubles:
        partner = detail.get(partner_key) or (names[1] if len(names) > 1 else "")
        detail[partner_key] = (partner or "").strip()
    else:
        detail[partner_key] = ""


def _derive_scores_for_status(sport_id: str, detail: Optional[dict], status: str) -> tuple[int, int]:
    # Chess should only publish canonical score once the match is completed.
    if sport_id == "chess" and status != "completed":
        return (0, 0)
    return scoring.derive_primary_scores(sport_id, detail)

@app.get("/api/matches", response_model=list[schemas.Match])
def get_matches(db: Session = Depends(get_db)):
    matches = db.query(models.Match).order_by(models.Match.scheduled_time).all()
    return [map_match_names(m, db) for m in matches]

@app.get("/api/matches/live", response_model=list[schemas.Match])
def get_live_matches(db: Session = Depends(get_db)):
    matches = db.query(models.Match).filter(models.Match.status == "live").order_by(models.Match.scheduled_time).all()
    return [map_match_names(m, db) for m in matches]

@app.get("/api/matches/sport/{sport_id}", response_model=list[schemas.Match])
def get_matches_by_sport(sport_id: str, db: Session = Depends(get_db)):
    matches = db.query(models.Match).filter(models.Match.sport_id == sport_id).order_by(models.Match.scheduled_time).all()
    return [map_match_names(m, db) for m in matches]

@app.post("/api/matches", response_model=schemas.Match)
def create_match(match: schemas.MatchCreate, db: Session = Depends(get_db), current_user: str = Depends(auth.verify_token)):
    if match.team1_id == match.team2_id:
        raise HTTPException(status_code=400, detail="Team 1 and Team 2 must be different")

    team1 = db.query(models.Team).filter(models.Team.id == match.team1_id).first()
    team2 = db.query(models.Team).filter(models.Team.id == match.team2_id).first()
    if not team1 or not team2:
        raise HTTPException(status_code=404, detail="One or both teams not found")

    if team1.sport_id != match.sport_id or team2.sport_id != match.sport_id:
        raise HTTPException(status_code=400, detail="Teams must belong to the selected sport")

    data = match.model_dump()
    detail = data.get("score_detail")
    if not detail:
        detail = scoring.default_score_detail(data["sport_id"])

    if data["sport_id"] in {"badminton", "table-tennis", "kho-kho", "chess", "weight-lifting"}:
        raw_category = detail.get("category") if isinstance(detail, dict) else None
        category = raw_category.strip() if isinstance(raw_category, str) else raw_category
        team1_category = (team1.category or "").strip() if isinstance(team1.category, str) else team1.category
        team2_category = (team2.category or "").strip() if isinstance(team2.category, str) else team2.category
        category = category or team1_category or team2_category
        if not category:
            raise HTTPException(status_code=400, detail="Subcategory is required for badminton/table-tennis matches")

        if team1_category != category or team2_category != category:
            raise HTTPException(status_code=400, detail="Both teams must be from the same selected subcategory")

        detail["category"] = category
        _apply_racket_lineup(detail, team1, "p1", category)
        _apply_racket_lineup(detail, team2, "p2", category)

    t1, t2 = _derive_scores_for_status(data["sport_id"], detail, "upcoming")
    db_match = models.Match(
        sport_id=data["sport_id"],
        team1_id=data["team1_id"],
        team2_id=data["team2_id"],
        scheduled_time=data.get("scheduled_time") or datetime.utcnow(),
        score_detail=detail,
        score_t1=t1,
        score_t2=t2,
    )
    db.add(db_match)
    db.flush()
    _recalculate_leaderboard_points(db)
    db.commit()
    db.refresh(db_match)
    return map_match_names(db_match, db)

@app.put("/api/matches/{match_id}", response_model=schemas.Match)
async def update_match(match_id: int, match_update: schemas.MatchUpdate, db: Session = Depends(get_db), current_user: str = Depends(auth.verify_token)):
    db_match = db.query(models.Match).filter(models.Match.id == match_id).first()
    if not db_match:
        raise HTTPException(status_code=404, detail="Match not found")

    payload = match_update.model_dump(exclude_unset=True)

    next_status = payload.get("status", db_match.status)

    next_detail = payload.get("score_detail", db_match.score_detail)

    if "score_detail" in payload and payload["score_detail"] is not None:
        t1, t2 = _derive_scores_for_status(db_match.sport_id, payload["score_detail"], next_status)
        payload["score_t1"] = t1
        payload["score_t2"] = t2
    elif "status" in payload:
        t1, t2 = _derive_scores_for_status(db_match.sport_id, next_detail, next_status)
        payload["score_t1"] = t1
        payload["score_t2"] = t2
    for key, value in payload.items():
        setattr(db_match, key, value)

    db.flush()
    _recalculate_leaderboard_points(db)
    
    # Tournament Sync Hook
    if next_status == "completed":
        _sync_tournament_bracket(db_match, db)

    db.commit()
    db.refresh(db_match)
    
    result = map_match_names(db_match, db)
    await manager.broadcast_json({"type": "match_updated", "match": result})
    return result
 
@app.post("/api/sports/{sport_id}/finalize")
def finalize_sport(sport_id: str, db: Session = Depends(get_db), current_user: str = Depends(auth.verify_token)):
    # 1. Reset all team points for this sport
    db.query(models.Team).filter(models.Team.sport_id == sport_id).update({models.Team.points: 0})
    
    # 2. Find ALL completed matches for this sport
    matches = db.query(models.Match).filter(
        models.Match.sport_id == sport_id,
        models.Match.status == "completed"
    ).all()
    
    # 3. Group by event_type, find the final match per event
    # If a match has is_final=True, use that for points.
    # Grouped so each event_type (boys_100m, relay_4x100, etc.) contributes independently.
    from collections import defaultdict
    by_event = defaultdict(list)
    for m in matches:
        et = (m.score_detail or {}).get("event_type", "default")
        by_event[et].append(m)
    
    total_applied = 0
    for event_type, event_matches in by_event.items():
        # Find the Final match for this event
        finals = [m for m in event_matches if (m.score_detail or {}).get("is_final")]
        for final_match in finals:
            _apply_athletics_points(db, final_match.score_detail)
            total_applied += 1
            
    db.commit()
    return {"detail": f"Leaderboard updated. Applied points from {total_applied} final match(es) across {len(by_event)} event type(s)."}

@app.delete("/api/matches/{match_id}")
def delete_match(match_id: int, db: Session = Depends(get_db), current_user: str = Depends(auth.verify_token)):
    db_match = db.query(models.Match).filter(models.Match.id == match_id).first()
    if not db_match:
        raise HTTPException(status_code=404, detail="Match not found")
    
    db.delete(db_match)
    db.flush()
    _recalculate_leaderboard_points(db)
    db.commit()
    return {"detail": "Match deleted"}


# ── Athletics Leaderboard Routes ─────────────────────────────────────────────

def _sort_entries(entries: list) -> list:
    """Sort entries: valid times ascending first, then disqualified at the end."""
    if not entries:
        return []
    valid = sorted(
        [e for e in entries if not e.get("is_disqualified") and (e.get("time_sec") or 0) > 0],
        key=lambda e: float(e.get("time_sec", 1e9))
    )
    no_time = [e for e in entries if not e.get("is_disqualified") and not ((e.get("time_sec") or 0) > 0)]
    dq = [e for e in entries if e.get("is_disqualified")]
    # Assign ranks
    rank = 1
    prev_time = None
    for e in valid:
        t = float(e.get("time_sec", 0))
        if t != prev_time:
            e["rank"] = rank
            prev_time = t
        else:
            e["rank"] = rank - 1  # tied rank
        rank += 1
    for e in no_time:
        e["rank"] = None
    for e in dq:
        e["rank"] = None
    return valid + no_time + dq


@app.get("/api/athletics/events", response_model=list[schemas.AthleticsEventOut])
def list_athletics_events(db: Session = Depends(get_db)):
    events = db.query(models.AthleticsEvent).order_by(models.AthleticsEvent.created_at).all()
    return events


@app.post("/api/athletics/events", response_model=schemas.AthleticsEventOut)
def create_athletics_event(
    payload: schemas.AthleticsEventCreate,
    db: Session = Depends(get_db),
    current_user: str = Depends(auth.verify_token)
):
    allowed = {"relay_4x100", "boys_100m", "girls_100m"}
    if payload.event_type not in allowed:
        raise HTTPException(status_code=400, detail=f"event_type must be one of {allowed}")
    ev = models.AthleticsEvent(
        event_type=payload.event_type,
        label=payload.label or "",
        status="upcoming",
        entries=[]
    )
    db.add(ev)
    db.commit()
    db.refresh(ev)
    return ev


@app.get("/api/athletics/events/{event_id}", response_model=schemas.AthleticsEventOut)
def get_athletics_event(event_id: int, db: Session = Depends(get_db)):
    ev = db.query(models.AthleticsEvent).filter(models.AthleticsEvent.id == event_id).first()
    if not ev:
        raise HTTPException(status_code=404, detail="Event not found")
    # Return with sorted entries
    ev.entries = _sort_entries(list(ev.entries or []))
    return ev


@app.post("/api/athletics/events/{event_id}/entries", response_model=schemas.AthleticsEventOut)
def add_athletics_entry(
    event_id: int,
    entry: schemas.AthleticsEntry,
    db: Session = Depends(get_db),
    current_user: str = Depends(auth.verify_token)
):
    ev = db.query(models.AthleticsEvent).filter(models.AthleticsEvent.id == event_id).first()
    if not ev:
        raise HTTPException(status_code=404, detail="Event not found")
    if ev.status == "completed":
        raise HTTPException(status_code=400, detail="Event is finalized. No further edits allowed.")
    entries = list(ev.entries or [])
    new_entry = {
        "id": str(uuid.uuid4()),
        "team_name": entry.team_name.strip(),
        "players": [p.strip() for p in (entry.players or [])],
        "time_sec": float(entry.time_sec),
        "is_disqualified": bool(entry.is_disqualified)
    }
    entries.append(new_entry)
    from sqlalchemy.orm.attributes import flag_modified
    ev.entries = _sort_entries(entries)
    flag_modified(ev, "entries")
    db.commit()
    db.refresh(ev)
    return ev


@app.put("/api/athletics/events/{event_id}/entries/{entry_id}", response_model=schemas.AthleticsEventOut)
def update_athletics_entry(
    event_id: int,
    entry_id: str,
    entry: schemas.AthleticsEntry,
    db: Session = Depends(get_db),
    current_user: str = Depends(auth.verify_token)
):
    ev = db.query(models.AthleticsEvent).filter(models.AthleticsEvent.id == event_id).first()
    if not ev:
        raise HTTPException(status_code=404, detail="Event not found")
    if ev.status == "completed":
        raise HTTPException(status_code=400, detail="Event is finalized. No further edits allowed.")
    entries = list(ev.entries or [])
    idx = next((i for i, e in enumerate(entries) if e.get("id") == entry_id), None)
    if idx is None:
        raise HTTPException(status_code=404, detail="Entry not found")
    entries[idx] = {
        "id": entry_id,
        "team_name": entry.team_name.strip(),
        "players": [p.strip() for p in (entry.players or [])],
        "time_sec": float(entry.time_sec),
        "is_disqualified": bool(entry.is_disqualified)
    }
    from sqlalchemy.orm.attributes import flag_modified
    ev.entries = _sort_entries(entries)
    flag_modified(ev, "entries")
    db.commit()
    db.refresh(ev)
    return ev


@app.delete("/api/athletics/events/{event_id}/entries/{entry_id}", response_model=schemas.AthleticsEventOut)
def delete_athletics_entry(
    event_id: int,
    entry_id: str,
    db: Session = Depends(get_db),
    current_user: str = Depends(auth.verify_token)
):
    ev = db.query(models.AthleticsEvent).filter(models.AthleticsEvent.id == event_id).first()
    if not ev:
        raise HTTPException(status_code=404, detail="Event not found")
    if ev.status == "completed":
        raise HTTPException(status_code=400, detail="Event is finalized. No further edits allowed.")
    entries = [e for e in (ev.entries or []) if e.get("id") != entry_id]
    from sqlalchemy.orm.attributes import flag_modified
    ev.entries = _sort_entries(entries)
    flag_modified(ev, "entries")
    db.commit()
    db.refresh(ev)
    return ev


@app.post("/api/athletics/events/{event_id}/finalize", response_model=schemas.AthleticsEventOut)
def finalize_athletics_event(
    event_id: int,
    db: Session = Depends(get_db),
    current_user: str = Depends(auth.verify_token)
):
    ev = db.query(models.AthleticsEvent).filter(models.AthleticsEvent.id == event_id).first()
    if not ev:
        raise HTTPException(status_code=404, detail="Event not found")
    if ev.status == "completed":
        raise HTTPException(status_code=400, detail="Event is already finalized.")
    ev.status = "completed"
    ev.finalized_at = datetime.utcnow()
    db.commit()
    db.refresh(ev)
    return ev


@app.delete("/api/athletics/events/{event_id}")
def delete_athletics_event(
    event_id: int,
    db: Session = Depends(get_db),
    current_user: str = Depends(auth.verify_token)
):
    ev = db.query(models.AthleticsEvent).filter(models.AthleticsEvent.id == event_id).first()
    if not ev:
        raise HTTPException(status_code=404, detail="Event not found")
    db.delete(ev)
    db.commit()
    return {"detail": "Event deleted"}


# ── Weight Lifting Leaderboard Routes ────────────────────────────────────────

def _best(attempts: list) -> float:
    """Return the highest valid (> 0) attempt or 0."""
    return max((float(a) for a in (attempts or []) if float(a) > 0), default=0.0)


def _calc_wl_entry(entry: dict) -> dict:
    """Compute squat_best, bench_best, dead_lift_best, total in-place."""
    squat_best   = _best(entry.get("squat",       [0, 0, 0]))
    bench_best   = _best(entry.get("bench_press",  [0, 0, 0]))
    dl_best      = _best(entry.get("dead_lift",    [0, 0, 0]))
    entry["squat_best"]     = squat_best
    entry["bench_best"]     = bench_best
    entry["dead_lift_best"] = dl_best
    entry["total"]          = squat_best + bench_best + dl_best
    return entry


def _sort_wl_entries(entries: list) -> list:
    """Sort descending by total; DQ'd at the bottom; assign ranks."""
    if not entries:
        return []
    for e in entries:
        _calc_wl_entry(e)

    valid = sorted(
        [e for e in entries if not e.get("is_disqualified")],
        key=lambda e: e["total"], reverse=True
    )
    dq = [e for e in entries if e.get("is_disqualified")]

    rank = 1
    prev_total = None
    for e in valid:
        if e["total"] != prev_total:
            e["rank"] = rank
            prev_total = e["total"]
        else:
            e["rank"] = rank - 1
        rank += 1

    for e in dq:
        e["rank"] = None

    return valid + dq


@app.get("/api/weightlifting/events", response_model=list[schemas.WeightLiftingEventOut])
def list_wl_events(db: Session = Depends(get_db)):
    return db.query(models.WeightLiftingEvent).order_by(models.WeightLiftingEvent.created_at).all()


@app.post("/api/weightlifting/events", response_model=schemas.WeightLiftingEventOut)
def create_wl_event(
    payload: schemas.WeightLiftingEventCreate,
    db: Session = Depends(get_db),
    current_user: str = Depends(auth.verify_token)
):
    ev = models.WeightLiftingEvent(label=payload.label or "", status="upcoming", entries=[])
    db.add(ev)
    db.commit()
    db.refresh(ev)
    return ev


@app.get("/api/weightlifting/events/{event_id}", response_model=schemas.WeightLiftingEventOut)
def get_wl_event(event_id: int, db: Session = Depends(get_db)):
    ev = db.query(models.WeightLiftingEvent).filter(models.WeightLiftingEvent.id == event_id).first()
    if not ev:
        raise HTTPException(status_code=404, detail="Event not found")
    ev.entries = _sort_wl_entries(list(ev.entries or []))
    return ev


@app.post("/api/weightlifting/events/{event_id}/entries", response_model=schemas.WeightLiftingEventOut)
def add_wl_entry(
    event_id: int,
    entry: schemas.WeightLiftingEntry,
    db: Session = Depends(get_db),
    current_user: str = Depends(auth.verify_token)
):
    ev = db.query(models.WeightLiftingEvent).filter(models.WeightLiftingEvent.id == event_id).first()
    if not ev:
        raise HTTPException(status_code=404, detail="Event not found")
    if ev.status == "completed":
        raise HTTPException(status_code=400, detail="Event is finalized.")
    entries = list(ev.entries or [])
    new_entry = _calc_wl_entry({
        "id": str(uuid.uuid4()),
        "name": entry.name.strip(),
        "squat":       [float(x) for x in (entry.squat or [0, 0, 0])],
        "bench_press": [float(x) for x in (entry.bench_press or [0, 0, 0])],
        "dead_lift":   [float(x) for x in (entry.dead_lift or [0, 0, 0])],
        "is_disqualified": bool(entry.is_disqualified),
    })
    entries.append(new_entry)
    from sqlalchemy.orm.attributes import flag_modified
    ev.entries = _sort_wl_entries(entries)
    flag_modified(ev, "entries")
    db.commit()
    db.refresh(ev)
    return ev


@app.put("/api/weightlifting/events/{event_id}/entries/{entry_id}", response_model=schemas.WeightLiftingEventOut)
def update_wl_entry(
    event_id: int,
    entry_id: str,
    entry: schemas.WeightLiftingEntry,
    db: Session = Depends(get_db),
    current_user: str = Depends(auth.verify_token)
):
    ev = db.query(models.WeightLiftingEvent).filter(models.WeightLiftingEvent.id == event_id).first()
    if not ev:
        raise HTTPException(status_code=404, detail="Event not found")
    if ev.status == "completed":
        raise HTTPException(status_code=400, detail="Event is finalized.")
    entries = list(ev.entries or [])
    idx = next((i for i, e in enumerate(entries) if e.get("id") == entry_id), None)
    if idx is None:
        raise HTTPException(status_code=404, detail="Entry not found")
    entries[idx] = _calc_wl_entry({
        "id": entry_id,
        "name": entry.name.strip(),
        "squat":       [float(x) for x in (entry.squat or [0, 0, 0])],
        "bench_press": [float(x) for x in (entry.bench_press or [0, 0, 0])],
        "dead_lift":   [float(x) for x in (entry.dead_lift or [0, 0, 0])],
        "is_disqualified": bool(entry.is_disqualified),
    })
    from sqlalchemy.orm.attributes import flag_modified
    ev.entries = _sort_wl_entries(entries)
    flag_modified(ev, "entries")
    db.commit()
    db.refresh(ev)
    return ev


@app.delete("/api/weightlifting/events/{event_id}/entries/{entry_id}", response_model=schemas.WeightLiftingEventOut)
def delete_wl_entry(
    event_id: int,
    entry_id: str,
    db: Session = Depends(get_db),
    current_user: str = Depends(auth.verify_token)
):
    ev = db.query(models.WeightLiftingEvent).filter(models.WeightLiftingEvent.id == event_id).first()
    if not ev:
        raise HTTPException(status_code=404, detail="Event not found")
    if ev.status == "completed":
        raise HTTPException(status_code=400, detail="Event is finalized.")
    entries = [e for e in (ev.entries or []) if e.get("id") != entry_id]
    from sqlalchemy.orm.attributes import flag_modified
    ev.entries = _sort_wl_entries(entries)
    flag_modified(ev, "entries")
    db.commit()
    db.refresh(ev)
    return ev


@app.post("/api/weightlifting/events/{event_id}/finalize", response_model=schemas.WeightLiftingEventOut)
def finalize_wl_event(
    event_id: int,
    db: Session = Depends(get_db),
    current_user: str = Depends(auth.verify_token)
):
    ev = db.query(models.WeightLiftingEvent).filter(models.WeightLiftingEvent.id == event_id).first()
    if not ev:
        raise HTTPException(status_code=404, detail="Event not found")
    if ev.status == "completed":
        raise HTTPException(status_code=400, detail="Event is already finalized.")
    ev.status = "completed"
    ev.finalized_at = datetime.utcnow()
    db.commit()
    db.refresh(ev)
    return ev


@app.delete("/api/weightlifting/events/{event_id}")
def delete_wl_event(
    event_id: int,
    db: Session = Depends(get_db),
    current_user: str = Depends(auth.verify_token)
):
    ev = db.query(models.WeightLiftingEvent).filter(models.WeightLiftingEvent.id == event_id).first()
    if not ev:
        raise HTTPException(status_code=404, detail="Event not found")
    db.delete(ev)
    db.commit()
    return {"detail": "Event deleted"}


# ── Tournament Bracket Routes ─────────────────────────────────────────────────

BRACKET_SPORTS = {
    'cricket', 'volleyball', 'football', 'badminton',
    'table-tennis', 'chess', 'carrom', 'tug-of-war', 'kho-kho', 'arm-wrestling'
}


def _next_pow2(n: int) -> int:
    p = 1
    while p < n:
        p *= 2
    return p


def _generate_bracket(teams: list) -> list:
    """
    Returns bracket as list-of-rounds.
    Each round is a list of match dicts:
      uid, round, position, teamA, teamB, winner, match_id, scheduled_at
    teamA/teamB: {id, name} | None (None = BYE in R1, TBD in later rounds)
    """
    n = len(teams)
    if n < 2:
        return []

    total_slots = _next_pow2(n)
    byes = total_slots - n

    # No shuffling — use the provided selection order as seeding
    # For N=9, byes=7. Top 7 teams get Byes, last 2 play in R1.
    bye_teams  = teams[:byes]
    real_teams = teams[byes:]

    # R1 slot pairs
    r1_pairs = [(t, None) for t in bye_teams]           # (team, BYE)
    for i in range(0, len(real_teams), 2):
        t1 = real_teams[i]
        t2 = real_teams[i + 1] if i + 1 < len(real_teams) else None
        r1_pairs.append((t1, t2))

    rounds = []

    # ── Round 1 ──
    r1_matches = []
    r1_next_winners = []
    for i, (tA, tB) in enumerate(r1_pairs):
        is_bye    = tB is None
        auto_win  = tA if is_bye else None
        r1_matches.append({
            "uid":          f"r1m{i + 1}",
            "round":        1,
            "position":     i + 1,
            "teamA":        tA,
            "teamB":        tB,       # None = BYE
            "winner":       auto_win,
            "match_id":     None,
            "scheduled_at": None,
        })
        r1_next_winners.append(auto_win)   # real team or None (TBD)
    rounds.append(r1_matches)

    # ── Subsequent rounds (all TBD until winners are set) ──
    round_num         = 2
    current_winners   = r1_next_winners   # list of team-dicts or None

    while len(current_winners) > 1:
        next_matches = []
        next_winners = []
        for i in range(0, len(current_winners), 2):
            tA  = current_winners[i]
            tB  = current_winners[i + 1] if i + 1 < len(current_winners) else None
            pos = i // 2 + 1
            next_matches.append({
                "uid":          f"r{round_num}m{pos}",
                "round":        round_num,
                "position":     pos,
                "teamA":        tA,    # real team if feeder was a BYE winner, else None
                "teamB":        tB,    # real team if feeder was a BYE winner, else None
                "winner":       None,
                "match_id":     None,
                "scheduled_at": None,
            })
            next_winners.append(None)
        rounds.append(next_matches)
        current_winners = next_winners
        round_num += 1

    # Add 3rd place match if there are at least 4 teams (Semifinal round exists)
    if len(rounds) >= 2:
        final_round_idx = len(rounds) - 1
        rounds[final_round_idx].append({
            "uid":          "3rd_place",
            "round":        final_round_idx + 1,
            "position":     2, # position 1 is the Grand Final
            "teamA":        None,
            "teamB":        None,
            "winner":       None,
            "match_id":     None,
            "scheduled_at": None,
            "is_3rd_place": True
        })

    return rounds


def _set_bracket_winner(bracket: list, match_uid: str, winner: dict) -> list:
    """Set winner in bracket and advance to next round."""
    for r_idx, rnd in enumerate(bracket):
        for m_idx, m in enumerate(rnd):
            if m["uid"] != match_uid:
                continue
            bracket[r_idx][m_idx]["winner"] = winner
            # Propagate to next round
            if r_idx + 1 < len(bracket):
                pos            = m["position"]           # 1-indexed
                next_match_idx = (pos - 1) // 2          # 0-indexed
                is_team_a      = (pos % 2 == 1)
                if next_match_idx < len(bracket[r_idx + 1]):
                    key = "teamA" if is_team_a else "teamB"
                    bracket[r_idx + 1][next_match_idx][key] = winner
            
            # Propagate LOSER to 3rd place match if this is a Semifinal
            if r_idx == len(bracket) - 2 and len(bracket) >= 2:
                # Find the 3rd place match in the final round
                third_match = next((x for x in bracket[-1] if x.get("is_3rd_place")), None)
                if third_match:
                    tA = m.get("teamA")
                    tB = m.get("teamB")
                    loser = tA if (tA and tA.get("id") != winner.get("id")) else tB
                    if m["position"] % 2 == 1:
                        third_match["teamA"] = loser
                    else:
                        third_match["teamB"] = loser

            return bracket
    raise ValueError(f"Match {match_uid} not found")


def _ensure_match_entries(bracket: list, sport_id: str, category: Optional[str], db) -> list:
    """Create Match DB entries for any bracket slot where both teams are now known."""
    for r_idx, rnd in enumerate(bracket):
        for m_idx, m in enumerate(rnd):
            if m.get("match_id"):
                continue
            tA = m.get("teamA")
            tB = m.get("teamB")
            if not tA or not tB:
                continue   # BYE or TBD — skip
            if tA.get("id") is None or tB.get("id") is None:
                continue
            # Both teams known → create Match
            sd = scoring.default_score_detail(sport_id)
            if category:
                sd["category"] = category
            sd["_tournament_match_uid"] = m["uid"]
            db_match = models.Match(
                sport_id  = sport_id,
                team1_id  = tA["id"],
                team2_id  = tB["id"],
                status    = "upcoming",
                score_detail = sd,
            )
            db.add(db_match)
            db.flush()
            bracket[r_idx][m_idx]["match_id"] = db_match.id
    return bracket


def _detect_match_winner(db_match: models.Match, db: Session) -> Optional[dict]:
    """Calculate the winner team based on scores and return snapshot {id, name}."""
    t1, t2 = scoring.derive_primary_scores(db_match.sport_id, db_match.score_detail)
    if t1 > t2:
        return {"id": db_match.team1_id, "name": db_match.team1.name if db_match.team1 else "Team 1"}
    elif t2 > t1:
        return {"id": db_match.team2_id, "name": db_match.team2.name if db_match.team2 else "Team 2"}
    return None  # Draw or undecided


def _sync_tournament_bracket(db_match: models.Match, db: Session):
    """Find any tournaments linked to this match and automatically advance the winner."""
    # Find tournaments that reference this match_id in their JSON bracket
    tournaments = db.query(models.Tournament).filter(
        models.Tournament.bracket.cast(String).contains(f'"match_id": {db_match.id}')
    ).all()

    winner = _detect_match_winner(db_match, db)
    if not winner:
         return

    from sqlalchemy.orm.attributes import flag_modified
    for t in tournaments:
        bracket = list(t.bracket or [])
        found_uid = None
        # Locate the specific match UID in the JSON
        for rnd in bracket:
            for m in rnd:
                if m.get("match_id") == db_match.id:
                    found_uid = m["uid"]
                    break
            if found_uid: break

        if found_uid:
            try:
                bracket = _set_bracket_winner(bracket, found_uid, winner)
                bracket = _ensure_match_entries(bracket, t.sport_id, t.category, db)
                t.bracket = bracket
                # Check if entire tournament is now finished
                if bracket and bracket[-1] and bracket[-1][0].get("winner"):
                    t.status = "completed"
                flag_modified(t, "bracket")
            except Exception as e:
                print(f"Failed to auto-advance bracket for Tournament {t.id}: {e}")

    db.flush()


@app.get("/api/tournaments", response_model=list[schemas.TournamentOut])
def list_tournaments(sport_id: Optional[str] = None, db: Session = Depends(get_db)):
    q = db.query(models.Tournament)
    if sport_id:
        q = q.filter(models.Tournament.sport_id == sport_id)
    return q.order_by(models.Tournament.created_at.desc()).all()


@app.post("/api/tournaments", response_model=schemas.TournamentOut)
def create_tournament(
    payload: schemas.TournamentCreate,
    db: Session = Depends(get_db),
    current_user: str = Depends(auth.verify_token),
):
    if payload.sport_id not in BRACKET_SPORTS:
        raise HTTPException(400, f"Tournament brackets only for: {', '.join(sorted(BRACKET_SPORTS))}")
    if len(payload.team_ids) < 2:
        raise HTTPException(400, "At least 2 teams are required to create a bracket.")

    teams_db = db.query(models.Team).filter(models.Team.id.in_(payload.team_ids)).all()
    if len(teams_db) < 2:
        raise HTTPException(400, "Could not resolve enough teams.")

    team_snapshots = [{"id": t.id, "name": t.name} for t in teams_db]
    bracket = _generate_bracket(team_snapshots)
    bracket = _ensure_match_entries(bracket, payload.sport_id, payload.category, db)

    tournament = models.Tournament(
        sport_id = payload.sport_id,
        name     = payload.name,
        category = payload.category,
        status   = "active",
        bracket  = bracket,
    )
    db.add(tournament)
    db.commit()
    db.refresh(tournament)
    return tournament


@app.get("/api/tournaments/{tournament_id}", response_model=schemas.TournamentOut)
def get_tournament(tournament_id: int, db: Session = Depends(get_db)):
    t = db.query(models.Tournament).filter(models.Tournament.id == tournament_id).first()
    if not t:
        raise HTTPException(404, "Tournament not found")
    return t


@app.post("/api/tournaments/{tournament_id}/set-winner", response_model=schemas.TournamentOut)
def set_tournament_winner(
    tournament_id: int,
    payload: schemas.TournamentSetWinner,
    db: Session = Depends(get_db),
    current_user: str = Depends(auth.verify_token),
):
    t = db.query(models.Tournament).filter(models.Tournament.id == tournament_id).first()
    if not t:
        raise HTTPException(404, "Tournament not found")

    bracket = list(t.bracket or [])
    winner  = {"id": payload.winner_id, "name": payload.winner_name}
    try:
        bracket = _set_bracket_winner(bracket, payload.match_uid, winner)
    except ValueError as e:
        raise HTTPException(400, str(e))

    # Create Match DB entries for newly-unblocked matches
    bracket = _ensure_match_entries(bracket, t.sport_id, t.category, db)

    # Check if tournament is finished (final winner set)
    if bracket and bracket[-1] and bracket[-1][0].get("winner"):
        t.status = "completed"

    from sqlalchemy.orm.attributes import flag_modified
    t.bracket = bracket
    flag_modified(t, "bracket")
    db.commit()
    db.refresh(t)
    return t


@app.post("/api/tournaments/{tournament_id}/set-details", response_model=schemas.TournamentOut)
def set_tournament_details(
    tournament_id: int,
    payload: schemas.TournamentSetDetails,
    db: Session = Depends(get_db),
    current_user: str = Depends(auth.verify_token),
):
    t = db.query(models.Tournament).filter(models.Tournament.id == tournament_id).first()
    if not t:
        raise HTTPException(404, "Tournament not found")

    bracket = list(t.bracket or [])
    found = False
    for r_idx, rnd in enumerate(bracket):
        for m_idx, m in enumerate(rnd):
            if m["uid"] == payload.match_uid:
                if payload.scheduled_at is not None:
                    bracket[r_idx][m_idx]["scheduled_at"] = payload.scheduled_at
                if payload.venue is not None:
                    bracket[r_idx][m_idx]["venue"] = payload.venue
                
                # Check if Match exists to sync
                match_id = m.get("match_id")
                if match_id:
                    db_match = db.query(models.Match).filter(models.Match.id == match_id).first()
                    if db_match:
                        from dateutil import parser
                        if payload.scheduled_at:
                            try:
                                db_match.scheduled_time = parser.parse(payload.scheduled_at)
                            except:
                                pass
                        if payload.venue is not None:
                            sd = dict(db_match.score_detail) if db_match.score_detail else {}
                            sd["venue"] = payload.venue
                            db_match.score_detail = sd
                found = True
                break
    if not found:
        raise HTTPException(404, f"Match {payload.match_uid} not found")

    flag_modified(t, "bracket")
    db.commit()
    db.refresh(t)
    return t


@app.post("/api/tournaments/{tournament_id}/bulk-set-details", response_model=schemas.TournamentOut)
def bulk_set_tournament_details(
    tournament_id: int,
    payload: schemas.TournamentBulkSetDetails,
    db: Session = Depends(get_db),
    current_user: str = Depends(auth.verify_token),
):
    t = db.query(models.Tournament).filter(models.Tournament.id == tournament_id).first()
    if not t:
        raise HTTPException(404, "Tournament not found")

    bracket = list(t.bracket or [])
    from dateutil import parser

    # Create a map for fast lookup of updates
    update_map = {up.match_uid: up for up in payload.updates}

    for r_idx, rnd in enumerate(bracket):
        for m_idx, m in enumerate(rnd):
            uid = m.get("uid")
            if uid in update_map:
                up = update_map[uid]
                # Update JSON bracket
                if up.scheduled_at is not None:
                    bracket[r_idx][m_idx]["scheduled_at"] = up.scheduled_at
                if up.venue is not None:
                    bracket[r_idx][m_idx]["venue"] = up.venue
                
                # Update DB match if exists
                match_id = m.get("match_id")
                if match_id:
                    db_match = db.query(models.Match).filter(models.Match.id == match_id).first()
                    if db_match:
                        if up.scheduled_at:
                            try:
                                db_match.scheduled_time = parser.parse(up.scheduled_at)
                            except:
                                pass
                        if up.venue is not None:
                            sd = dict(db_match.score_detail) if db_match.score_detail else {}
                            sd["venue"] = up.venue
                            db_match.score_detail = sd

    from sqlalchemy.orm.attributes import flag_modified
    t.bracket = bracket
    flag_modified(t, "bracket")
    db.commit()
    db.refresh(t)
    return t


@app.post("/api/tournaments/{tournament_id}/swap-teams", response_model=schemas.TournamentOut)
def swap_tournament_teams(
    tournament_id: int,
    payload: schemas.TournamentSwapTeams,
    db: Session = Depends(get_db),
    current_user: str = Depends(auth.verify_token),
):
    t = db.query(models.Tournament).filter(models.Tournament.id == tournament_id).first()
    if not t:
        raise HTTPException(404, "Tournament not found")

    bracket = list(t.bracket or [])
    
    # Validation block: Ensure matches are not played (no winner)
    def find_match(uid):
        for r, rnd in enumerate(bracket):
            for m, match in enumerate(rnd):
                if match["uid"] == uid:
                    if match.get("winner"):
                        raise ValueError(f"Cannot swap teams in a match that is already decided ({uid})")
                    return match
        raise ValueError(f"Match not found: {uid}")

    try:
        match_src = find_match(payload.match_uid_src)
        match_tgt = find_match(payload.match_uid_tgt)
    except ValueError as e:
        raise HTTPException(400, str(e))

    # Pull existing teams
    src_val = match_src.get(payload.team_key_src)
    tgt_val = match_tgt.get(payload.team_key_tgt)

    # Swap in bracket JSON
    match_src[payload.team_key_src] = tgt_val
    match_tgt[payload.team_key_tgt] = src_val

    # Update real Match rows if they exist
    def _sync_match_db(m):
        match_id = m.get("match_id")
        tA = m.get("teamA")
        tB = m.get("teamB")
        if match_id and tA and tB:
            db_match = db.query(models.Match).filter(models.Match.id == match_id).first()
            if db_match:
                db_match.team1_id = tA.get("id")
                db_match.team2_id = tB.get("id")

    _sync_match_db(match_src)
    _sync_match_db(match_tgt)

    from sqlalchemy.orm.attributes import flag_modified
    t.bracket = bracket
    flag_modified(t, "bracket")
    db.commit()
    db.refresh(t)
    return t


@app.delete("/api/tournaments/{tournament_id}")
def delete_tournament(
    tournament_id: int,
    db: Session = Depends(get_db),
    current_user: str = Depends(auth.verify_token),
):
    t = db.query(models.Tournament).filter(models.Tournament.id == tournament_id).first()
    if not t:
        raise HTTPException(404, "Tournament not found")

    # Delete linked Match rows
    match_ids = [
        m["match_id"]
        for rnd in (t.bracket or [])
        for m in rnd
        if m.get("match_id")
    ]
    if match_ids:
        db.query(models.Match).filter(models.Match.id.in_(match_ids)).delete(synchronize_session=False)

    db.delete(t)
    db.commit()
    return {"detail": "Tournament deleted"}
