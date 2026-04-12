# SportsFest INFINITO - EIFER

A modern, visually striking sports event website for SportsFest INFINITO. This project features a sleek black-and-red design with dynamic, glowing components. It is built using **React + Vite** for the frontend and **FastAPI** for the backend.

## Architecture

- **Frontend:** React, Vite, React Router DOM, Axios, Custom Vanilla CSS
- **Backend:** FastAPI, SQLAlchemy, SQLite Database, JWT Authentication
- **Database Model:** 
  - `Users` (for admin authentication)
  - `Teams` (stores individual or group participants and points)
  - `Matches` (stores schedule and scores)
- **Features:** Live Matches, Sport-wise Details, Overall Leaderboard, JWT Admin Login, Live Match Status Control.

## Requirements

- Node.js (v18+)
- Python (3.10+)

## Local Development

### Backend

From the repository root, activate your virtual environment and start FastAPI with the package entrypoint:

```bash
uvicorn backend.main:app --reload
```

If you prefer to run from inside the backend folder, use the module path relative to that directory:

```bash
uvicorn main:app --reload
```

### Frontend

From the `frontend` folder:

```bash
npm install
npm run dev
```

For a production-style local check:

```bash
npm run build
```

## Deployment (Vercel Frontend + Render Backend + Supabase)

This project is deployable with the following split:

- Frontend: Vercel (Vite static build)
- Backend: Render Web Service (FastAPI + Uvicorn)
- Database: Supabase Postgres

### 1) Backend on Render (Dockerfile-based)

This repo includes `backend/Dockerfile` for Render Docker deployment.

Option A (recommended): use Blueprint deployment from `render.yaml`.

- Push repo changes to GitHub.
- In Render, create service using Blueprint (`render.yaml`).
- Render will build using `backend/Dockerfile` (no manual Build/Start command needed).

Option B (manual): create a Render Web Service with runtime `Docker` and set Dockerfile path to `backend/Dockerfile`.

Set these environment variables on Render (see `backend/.env.example`):

- `DATABASE_URL` = your Supabase Postgres URL (pooler URL recommended)
- `SECRET_KEY` = long random string
- `CORS_ORIGINS` = your Vercel domain(s), comma-separated
- `CORS_ALLOW_CREDENTIALS` = `false`

### 2) Frontend on Vercel

Import this repo on Vercel and set Root Directory to `frontend`.

Set environment variables on Vercel (see `frontend/.env.example`):

- `VITE_API_BASE_URL` = `https://<your-render-service>.onrender.com/api`
- `VITE_WS_BASE_URL` = `wss://<your-render-service>.onrender.com/api/ws/matches`

SPA route refresh support is configured in `frontend/vercel.json`.

Note: Vercel does not deploy this project from Dockerfile in this setup. Use standard Vite build on Vercel.

### 3) Verify

- Open `https://<your-render-service>.onrender.com/docs`
- Open Vercel frontend URL and test login and live score updates
