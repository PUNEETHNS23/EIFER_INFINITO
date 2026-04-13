import os
from pathlib import Path
from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parent
load_dotenv(BACKEND_DIR / ".env")

from fastapi import FastAPI, Depends, HTTPException, status, WebSocket, WebSocketDisconnect
from fastapi.encoders import jsonable_encoder
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from sqlalchemy.engine.url import make_url
from datetime import timedelta

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
        if len(player_names) != 11 or any(not name for name in player_names):
            raise HTTPException(status_code=400, detail="Football teams must include exactly 11 player names.")
        if len(set(player_names)) != 11:
            raise HTTPException(status_code=400, detail="Football player names must be unique.")
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

def _apply_match_points(db: Session, team1_id: int, team2_id: int, score_t1: int, score_t2: int):
    t1 = db.query(models.Team).filter(models.Team.id == team1_id).first()
    t2 = db.query(models.Team).filter(models.Team.id == team2_id).first()
    if not t1 or not t2:
        return

    if score_t1 > score_t2:
        t1.points += 3
    elif score_t2 > score_t1:
        t2.points += 3
    else:
        t1.points += 1
        t2.points += 1


def _reverse_match_points(db: Session, team1_id: int, team2_id: int, score_t1: int, score_t2: int):
    t1 = db.query(models.Team).filter(models.Team.id == team1_id).first()
    t2 = db.query(models.Team).filter(models.Team.id == team2_id).first()
    if not t1 or not t2:
        return

    if score_t1 > score_t2:
        t1.points = max(0, t1.points - 3)
    elif score_t2 > score_t1:
        t2.points = max(0, t2.points - 3)
    else:
        t1.points = max(0, t1.points - 1)
        t2.points = max(0, t2.points - 1)

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

    if data["sport_id"] in {"badminton", "table-tennis"}:
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

    t1, t2 = scoring.derive_primary_scores(data["sport_id"], detail)
    db_match = models.Match(
        sport_id=data["sport_id"],
        team1_id=data["team1_id"],
        team2_id=data["team2_id"],
        scheduled_time=data["scheduled_time"],
        score_detail=detail,
        score_t1=t1,
        score_t2=t2,
    )
    db.add(db_match)
    db.commit()
    db.refresh(db_match)
    return map_match_names(db_match, db)

@app.put("/api/matches/{match_id}", response_model=schemas.Match)
async def update_match(match_id: int, match_update: schemas.MatchUpdate, db: Session = Depends(get_db), current_user: str = Depends(auth.verify_token)):
    db_match = db.query(models.Match).filter(models.Match.id == match_id).first()
    if not db_match:
        raise HTTPException(status_code=404, detail="Match not found")
    
    old_status = db_match.status
    old_score_t1 = db_match.score_t1
    old_score_t2 = db_match.score_t2

    payload = match_update.model_dump(exclude_unset=True)
    if "score_detail" in payload and payload["score_detail"] is not None:
        t1, t2 = scoring.derive_primary_scores(db_match.sport_id, payload["score_detail"])
        payload["score_t1"] = t1
        payload["score_t2"] = t2
    for key, value in payload.items():
        setattr(db_match, key, value)

    # Points logic:
    # - If the match was previously completed, remove the old result points.
    # - If the match is now completed, apply points for the new result.
    if old_status == "completed":
        _reverse_match_points(db, db_match.team1_id, db_match.team2_id, old_score_t1, old_score_t2)

    if db_match.status == "completed":
        _apply_match_points(db, db_match.team1_id, db_match.team2_id, db_match.score_t1, db_match.score_t2)
            
    db.commit()
    db.refresh(db_match)
    
    result = map_match_names(db_match, db)
    await manager.broadcast_json({"type": "match_updated", "match": result})
    return result

@app.delete("/api/matches/{match_id}")
def delete_match(match_id: int, db: Session = Depends(get_db), current_user: str = Depends(auth.verify_token)):
    db_match = db.query(models.Match).filter(models.Match.id == match_id).first()
    if not db_match:
        raise HTTPException(status_code=404, detail="Match not found")
    
    # Reverse points if match was completed
    if db_match.status == "completed":
        _reverse_match_points(db, db_match.team1_id, db_match.team2_id, db_match.score_t1, db_match.score_t2)
    
    db.delete(db_match)
    db.commit()
    return {"detail": "Match deleted"}
