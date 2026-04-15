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

from sqlalchemy import inspect, text
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
        normalized_squad = []
        for player in squad:
            normalized_player = dict(player)
            normalized_player["name"] = (player.get("name") or "").strip()
            normalized_squad.append(normalized_player)
        player_names = [p.get("name") or "" for p in normalized_squad]
        if any(not name for name in player_names):
            raise HTTPException(status_code=400, detail="Player names cannot be empty.")
        if len(set(player_names)) != len(player_names):
            raise HTTPException(status_code=400, detail="Player names must be unique within the team.")
        if any(bool(p.get("is_substitute")) for p in normalized_squad):
            raise HTTPException(status_code=400, detail="Substitute players are not allowed for badminton/table-tennis teams.")

        required_count = 2 if "Doubles" in category else 1
        if len(player_names) != required_count:
            raise HTTPException(
                status_code=400,
                detail=f"{category} requires exactly {required_count} player(s) per team.",
            )
        team.squad = normalized_squad

    if team.sport_id == "football":
        squad = team.squad or []
        normalized_squad = []
        for player in squad:
            normalized_player = dict(player)
            normalized_player["name"] = (player.get("name") or "").strip()
            normalized_squad.append(normalized_player)
        player_names = [p.get("name") or "" for p in normalized_squad]
        if len(player_names) > 11:
            raise HTTPException(status_code=400, detail="Football teams can have at most 11 players.")
        if any(not name for name in player_names):
            raise HTTPException(status_code=400, detail="Football player names cannot be empty.")
        if len(set(player_names)) != len(player_names):
            raise HTTPException(status_code=400, detail="Football player names must be unique.")
        team.squad = normalized_squad
        
    if team.sport_id == "chess":
        category = (team.category or "").strip()
        if category not in {"Rapid", "Blitz", "Hand & Brain"}:
            raise HTTPException(status_code=400, detail="Chess teams require a valid category.")
        team.category = category

        squad = team.squad or []
        normalized_squad = []
        for player in squad:
            if player.get("is_substitute"):
                raise HTTPException(status_code=400, detail="Substitutes are not allowed in chess.")
            normalized_player = dict(player)
            normalized_player["name"] = (player.get("name") or "").strip()
            normalized_squad.append(normalized_player)
            
        player_names = [p.get("name") or "" for p in normalized_squad]
        if any(not name for name in player_names):
            raise HTTPException(status_code=400, detail="Player names cannot be empty.")
        if len(set(player_names)) != len(player_names):
            raise HTTPException(status_code=400, detail="Player names must be unique within the team.")
            
        required_count = {"Rapid": 4, "Hand & Brain": 2}.get(category, 1)
        if len(player_names) != required_count:
            raise HTTPException(
                status_code=400,
                detail=f"Chess {category} requires exactly {required_count} player(s) per team.",
            )
        team.squad = normalized_squad
        
    if team.sport_id == "weight-lifting":
        category = (team.category or "").strip()
        if category not in {"Squat", "Bench Press", "Dead Lift"}:
            raise HTTPException(status_code=400, detail="Weight-lifting teams require a valid category.")
        team.category = category

        squad = team.squad or []
        normalized_squad = []
        for player in squad:
            if player.get("is_substitute"):
                raise HTTPException(status_code=400, detail="Substitutes are not allowed in weight-lifting.")
            normalized_player = dict(player)
            normalized_player["name"] = (player.get("name") or "").strip()
            normalized_squad.append(normalized_player)
            
        player_names = [p.get("name") or "" for p in normalized_squad]
        if any(not name for name in player_names):
            raise HTTPException(status_code=400, detail="Player names cannot be empty.")
        if len(set(player_names)) != len(player_names):
            raise HTTPException(status_code=400, detail="Player names must be unique within the team.")
            
        if len(player_names) != 1:
            raise HTTPException(status_code=400, detail="Weight-lifting requires exactly 1 player per team.")
        team.squad = normalized_squad

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
