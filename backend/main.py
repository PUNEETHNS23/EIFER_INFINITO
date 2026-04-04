from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import timedelta

import models, schemas, database, auth

models.Base.metadata.create_all(bind=database.engine)

app = FastAPI(title="SportsFest INFINITO API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # For dev. In prod, specify the origins
    allow_credentials=True,
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
    db_team = models.Team(**team.dict())
    db.add(db_team)
    db.commit()
    db.refresh(db_team)
    return db_team

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
    match_dict = m.__dict__.copy()
    t1 = db.query(models.Team).filter(models.Team.id == m.team1_id).first()
    t2 = db.query(models.Team).filter(models.Team.id == m.team2_id).first()
    match_dict['team1'] = t1.name if t1 else "Unknown"
    match_dict['team2'] = t2.name if t2 else "Unknown"
    return match_dict

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
    db_match = models.Match(**match.dict())
    db.add(db_match)
    db.commit()
    db.refresh(db_match)
    return map_match_names(db_match, db)

@app.put("/api/matches/{match_id}", response_model=schemas.Match)
def update_match(match_id: int, match_update: schemas.MatchUpdate, db: Session = Depends(get_db), current_user: str = Depends(auth.verify_token)):
    db_match = db.query(models.Match).filter(models.Match.id == match_id).first()
    if not db_match:
        raise HTTPException(status_code=404, detail="Match not found")
    
    # update points logic
    was_not_completed = db_match.status != "completed"
    
    for key, value in match_update.dict().items():
        setattr(db_match, key, value)
    
    if match_update.status == "completed" and was_not_completed:
        # Give 3 points to winner, 1 for draw
        t1 = db.query(models.Team).filter(models.Team.id == db_match.team1_id).first()
        t2 = db.query(models.Team).filter(models.Team.id == db_match.team2_id).first()
        if db_match.score_t1 > db_match.score_t2:
            t1.points += 3
        elif db_match.score_t2 > db_match.score_t1:
            t2.points += 3
        else:
            t1.points += 1
            t2.points += 1
            
    db.commit()
    db.refresh(db_match)
    return map_match_names(db_match, db)

@app.delete("/api/matches/{match_id}")
def delete_match(match_id: int, db: Session = Depends(get_db), current_user: str = Depends(auth.verify_token)):
    db_match = db.query(models.Match).filter(models.Match.id == match_id).first()
    if not db_match:
        raise HTTPException(status_code=404, detail="Match not found")
    
    # Reverse points if match was completed
    if db_match.status == "completed":
        t1 = db.query(models.Team).filter(models.Team.id == db_match.team1_id).first()
        t2 = db.query(models.Team).filter(models.Team.id == db_match.team2_id).first()
        if t1 and t2:
            if db_match.score_t1 > db_match.score_t2:
                t1.points = max(0, t1.points - 3)
            elif db_match.score_t2 > db_match.score_t1:
                t2.points = max(0, t2.points - 3)
            else:
                t1.points = max(0, t1.points - 1)
                t2.points = max(0, t2.points - 1)
    
    db.delete(db_match)
    db.commit()
    return {"detail": "Match deleted"}
