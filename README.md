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

## Quick Start Setup

### Step 1: Clone or Navigate to the Directory
Ensure you are at the root `EiferWebsite` folder.

### Step 2: Set Up the Backend
1. `cd backend`
2. Create virtual environment: `python -m venv venv`
3. Activate the virtual environment:
   - **Windows:** `.\venv\Scripts\activate`
   - **Mac/Linux:** `source venv/bin/activate`
4. Install dependencies: `pip install fastapi uvicorn sqlalchemy pydantic passlib[bcrypt] python-jose websockets python-multipart`
5. Run the FastAPI dev server: `uvicorn main:app --reload`
6. *Note*: The backend runs at `http://localhost:8000`

### Step 3: Set Up the Frontend
1. Open a new terminal and `cd frontend`
2. Install dependencies: `npm install`
3. Add Logo: Save the provided EIFER logo image inside `frontend/public/` as `eifer-logo.png`. Replace the placeholder `{/* EIFER LOGO PLACEHOLDER */}` text in `frontend/src/App.jsx` with an `<img>` tag pointing to `/eifer-logo.png`.
4. Run the development server: `npm run dev`
5. Visit `http://localhost:5173` to view the website.

### Admin Access
- The default database initialization creates an admin account automatically.
- Navigate to the **Admin Login** page.
- **Username:** `admin`
- **Password:** `admin`
- This grants access to the **Command Center** where you can create matches, update live scores, and manage teams in real-time.

## Customization
- **CSS Variables:** The core aesthetic is powered by CSS variables inside `frontend/src/index.css`. You can tweak the colors such as `--color-primary` or `--color-bg-surface` freely.
- **Logo Usage:** Make sure to drop your `eifer-logo.png` inside the `public` directory so it resolves correctly across the site layout.
