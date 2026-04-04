import { BrowserRouter as Router, Routes, Route, Link, Outlet, useLocation } from 'react-router-dom';
import { useState } from 'react';
import Home from './pages/Home';
import SportDetails from './pages/SportDetails';
import AdminDashboard from './pages/AdminDashboard';
import Login from './pages/Login';
import Leaderboard from './pages/Leaderboard';
import { AuthProvider, useAuth } from './context/AuthContext';
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
          <img src="/eifer-logo.png" alt="EIFER" className="nav-logo" onError={(e) => { e.target.style.display='none'; }} />
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
            <span className="footer-tagline">by EIFER Sports Club</span>
          </div>
          <p className="footer-copy">&copy; {new Date().getFullYear()} SportsFest INFINITO. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="sport/:id" element={<SportDetails />} />
            <Route path="leaderboard" element={<Leaderboard />} />
            <Route path="admin" element={<AdminDashboard />} />
            <Route path="login" element={<Login />} />
          </Route>
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;
