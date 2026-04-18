import { BrowserRouter as Router, Routes, Route, Link, Outlet, useLocation, useParams, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './context/useAuth';
import Home from './pages/Home';
import About from './pages/About';
import SportDetails from './pages/SportDetails';
import AdminDashboard from './pages/AdminDashboard';
import AdminCreateMatch from './pages/AdminCreateMatch';
import AdminAutomaticSchedule from './pages/AdminAutomaticSchedule';
import AdminSportScore from './pages/AdminSportScore';
import AdminWeightLifting from './pages/AdminWeightLifting';
import AdminAthleticsEventManager from './pages/AdminAthleticsEventManager';
import AthleticsEvents from './pages/AthleticsEvents';
import AthleticsEventDetail from './pages/AthleticsEventDetail';
import AdminWeightliftingEventManager from './pages/AdminWeightliftingEventManager';
import WeightliftingEvents from './pages/WeightliftingEvents';
import WeightliftingEventDetail from './pages/WeightliftingEventDetail';
import Login from './pages/Login';
import Leaderboard from './pages/Leaderboard';
import MatchDetailsCricket from './pages/MatchDetailsCricket';
import MatchDetailsVolleyball from './pages/MatchDetailsVolleyball';
import MatchDetailsFootball from './pages/MatchDetailsFootball';
import MatchDetailsGeneric from './pages/MatchDetailsGeneric';
import AdminTournament from './pages/AdminTournament';
import AdminTournamentMatchEdit from './pages/AdminTournamentMatchEdit';
import AdminTournamentBulkSchedule from './pages/AdminTournamentBulkSchedule';
import TournamentBracketView from './pages/TournamentBracketView';
import api from './api';
import './App.css';

function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const isActive = (path) => location.pathname === path ? 'active' : '';

  return (
    <div className="app-container">
      <nav className="navbar">
        <Link to="/" className="nav-brand">
          <img src="/eifer-logo-no-bg.png" alt="EIFER" className="nav-logo" onError={(e) => { e.target.style.display='none'; }} />
          <div className="brand-text">
            <span className="brand-name">INFINITO</span>
            <span className="brand-sub">BY EIFER</span>
          </div>
        </Link>

        <button className="hamburger" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle menu">
          <span className={menuOpen ? 'open' : ''}></span>
          <span className={menuOpen ? 'open' : ''}></span>
          <span className={menuOpen ? 'open' : ''}></span>
        </button>

        <div className={`nav-links ${menuOpen ? 'nav-open' : ''}`}>
          <Link to="/" className={`nav-link ${isActive('/')}`} onClick={() => setMenuOpen(false)}>Home</Link>
          <Link to="/about" className={`nav-link ${isActive('/about')}`} onClick={() => setMenuOpen(false)}>About Co-ordinators</Link>
          <Link to="/leaderboard" className={`nav-link ${isActive('/leaderboard')}`} onClick={() => setMenuOpen(false)}>Leaderboard</Link>
          {user ? (
            <>
              <Link to="/admin" className={`nav-link ${isActive('/admin')}`} onClick={() => setMenuOpen(false)}>Dashboard</Link>
              <button onClick={() => { logout(); setMenuOpen(false); }} className="nav-link nav-logout">Logout</button>
            </>
          ) : (
            <Link to="/login" className="nav-link nav-login-btn" onClick={() => setMenuOpen(false)}>Admin Login</Link>
          )}
        </div>
      </nav>
      <main className="main-content">
        <Outlet />
      </main>
      <footer className="footer">
        <div className="footer-inner container">
          <div className="footer-brand">
            <span className="footer-logo-text">INFINITO</span>
            <span className="footer-tagline">by EIFER Sports Society</span>
          </div>
          <p className="footer-copy">&copy; {new Date().getFullYear()} SportsFest INFINITO. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

function MatchDetailsBridge() {
  const { id } = useParams();
  const [sportId, setSportId] = useState(null);

  useEffect(() => {
    api.get(`/matches`).then(res => {
      const match = res.data.find(m => String(m.id) === id);
      if (match) setSportId(match.sport_id);
    });
  }, [id]);

  if (!sportId) return (
    <div className="container" style={{ padding: '4rem 1rem', textAlign: 'center' }}>
      <p>Loading Match Details...</p>
    </div>
  );

  if (sportId === 'cricket') return <MatchDetailsCricket />;
  if (sportId === 'volleyball') return <MatchDetailsVolleyball />;
  if (sportId === 'football') return <MatchDetailsFootball />;

  return <MatchDetailsGeneric />;
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="about" element={<About />} />
            <Route path="sport/athletics" element={<AthleticsEvents />} />
            <Route path="sport/weight-lifting" element={<WeightliftingEvents />} />
            <Route path="sport/:id" element={<SportDetails />} />
            <Route path="athletics/:eventId" element={<AthleticsEventDetail />} />
            <Route path="weightlifting/:eventId" element={<WeightliftingEventDetail />} />
            <Route path="match/:id" element={<MatchDetailsBridge />} />
            <Route path="leaderboard" element={<Leaderboard />} />
            <Route path="admin" element={<AdminDashboard />} />
            <Route path="admin/create-match/:sportId" element={<AdminCreateMatch />} />
            <Route path="admin/automatic-schedule/:sportId" element={<AdminAutomaticSchedule />} />
            <Route path="admin/score/weight-lifting" element={<AdminWeightLifting />} />
            <Route path="admin/athletics" element={<AdminAthleticsEventManager />} />
            <Route path="admin/weight-lifting" element={<AdminWeightliftingEventManager />} />
            <Route path="admin/score/:sportId" element={<AdminSportScore />} />
            <Route path="login" element={<Login />} />
            <Route path="admin/tournament/:sportId?" element={<AdminTournament />} />
            <Route path="admin/tournament/:tournamentId/match/:matchUid" element={<AdminTournamentMatchEdit />} />
            <Route path="admin/tournament/:tournamentId/schedule" element={<AdminTournamentBulkSchedule />} />
            <Route path="tournament/:tournamentId" element={<TournamentBracketView />} />
          </Route>
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;
