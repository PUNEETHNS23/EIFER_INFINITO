import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import SportScoreboard from '../components/SportScoreboard';
import { SPORTS } from '../sports/sportsConfig';
import { useMatchSocket } from '../hooks/useMatchSocket';
import './Home.css';

function Home() {
  const [liveMatches, setLiveMatches] = useState([]);
  const [upcomingMatches, setUpcomingMatches] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const liveRes = await api.get('/matches/live');
        setLiveMatches(liveRes.data);
      } catch (err) {
        console.error('Failed to fetch live matches', err);
      }
      try {
        const allRes = await api.get('/matches');
        setUpcomingMatches(allRes.data.filter(m => m.status === 'upcoming').slice(0, 4));
      } catch (err) {
        console.error('Failed to fetch matches', err);
      }
    };
    fetchData();
  }, []);

  useMatchSocket((updatedMatch) => {
    setLiveMatches((prev) => {
      if (updatedMatch.status === 'live') {
        const idx = prev.findIndex((m) => m.id === updatedMatch.id);
        if (idx >= 0) {
          const arr = [...prev];
          arr[idx] = updatedMatch;
          return arr;
        }
        return [...prev, updatedMatch];
      }
      return prev.filter((m) => m.id !== updatedMatch.id);
    });
    
    setUpcomingMatches((prev) => {
      if (updatedMatch.status === 'upcoming') {
        const idx = prev.findIndex((m) => m.id === updatedMatch.id);
        if (idx >= 0) {
          const arr = [...prev];
          arr[idx] = updatedMatch;
          return arr;
        }
      }
      return prev.filter((m) => m.id !== updatedMatch.id || updatedMatch.status === 'upcoming');
    });
  });

  return (
    <div className="home-page">

      {/* ===== HERO SECTION ===== */}
      <section className="hero">
        {/* Decorative blobs */}
        <div className="blob blob-1"></div>
        <div className="blob blob-2"></div>
        <div className="blob blob-3"></div>

        {/* Decorative floating shapes */}
        <div className="deco-circle deco-circle-1"></div>
        <div className="deco-circle deco-circle-2"></div>
        <div className="deco-wave deco-wave-1">
          <svg viewBox="0 0 120 20" fill="none"><path d="M0 10 Q15 0 30 10 Q45 20 60 10 Q75 0 90 10 Q105 20 120 10" stroke="var(--color-primary)" strokeWidth="2" fill="none"/></svg>
        </div>
        <div className="deco-wave deco-wave-2">
          <svg viewBox="0 0 120 20" fill="none"><path d="M0 10 Q15 0 30 10 Q45 20 60 10 Q75 0 90 10 Q105 20 120 10" stroke="var(--color-primary)" strokeWidth="2" fill="none"/></svg>
        </div>
        <div className="deco-dots">
          {Array.from({length: 9}).map((_, i) => <span key={i}></span>)}
        </div>

        <div className="hero-content container">
          <div className="hero-text">
            <p className="hero-tag">EIFER SPORTS CLUB PRESENTS</p>
            <h1 className="hero-title">
              <span className="hero-title-line1">SPORTS FEST</span>
              <span className="hero-title-line2">Infinito</span>
            </h1>
            <p className="hero-description">
              The ultimate intra-college sports tournament. 13 disciplines. One champion.
              Compete, dominate, and rise to glory.
            </p>
            <div className="hero-actions">
              <Link to="/leaderboard" className="btn-hero-primary">
                <span>View Leaderboard</span>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              </Link>
              <a href="#sports" className="btn-hero-outline">Explore Sports</a>
            </div>
            <div className="hero-stats">
              <div className="hero-stat">
                <span className="hero-stat-number">13</span>
                <span className="hero-stat-label">Sports</span>
              </div>
              <div className="hero-stat-divider"></div>
              <div className="hero-stat">
                <span className="hero-stat-number">50+</span>
                <span className="hero-stat-label">Teams</span>
              </div>
              <div className="hero-stat-divider"></div>
              <div className="hero-stat">
                <span className="hero-stat-number">100+</span>
                <span className="hero-stat-label">Matches</span>
              </div>
            </div>
          </div>
          <div className="hero-image-wrapper">
            <div className="hero-image-glow"></div>
            <img src="/eifer-logo-no-bg.png" alt="EIFER Eagle" className="hero-image" />
          </div>
        </div>
        <div className="hero-scroll-indicator">
          <span></span>
        </div>
      </section>

      {/* ===== LIVE MATCHES ===== */}
      <section className="section container" id="live">
        <div className="section-header">
          <div className="section-tag"><span className="live-indicator"></span> HAPPENING NOW</div>
          <h2 className="section-title">Live Matches</h2>
        </div>
        <div className="live-matches-grid">
          {liveMatches.length > 0 ? (
            liveMatches.map((match) => (
              <div key={match.id} className="match-card-live">
                <div className="match-card-live-glow"></div>
                <div className="match-card-live-header">
                  <span className="match-badge live-badge"><span className="live-dot"></span>LIVE</span>
                  <span className="match-sport-tag">{match.sport_id.replace('-', ' ').toUpperCase()}</span>
                </div>
                <div className="match-card-live-body">
                  <SportScoreboard match={match} compact />
                </div>
                <Link to={match.sport_id === 'cricket' ? `/match/${match.id}` : `/sport/${match.sport_id}`} className="match-card-live-link">
                  Watch Details →
                </Link>
              </div>
            ))
          ) : (
            <div className="empty-state-premium">
              <div className="empty-icon">📡</div>
              <h3>No Live Matches</h3>
              <p>Check back during event hours for live score updates</p>
            </div>
          )}
        </div>
      </section>

      {/* ===== SPORTS CATEGORIES ===== */}
      <section className="section container" id="sports">
        <div className="section-header">
          <div className="section-tag">CHOOSE YOUR ARENA</div>
          <h2 className="section-title">Sports Categories</h2>
        </div>
        <div className="sports-grid">
          {SPORTS.map((sport, index) => (
            <Link to={`/sport/${sport.id}`} key={sport.id} className="sport-card-premium" style={{ animationDelay: `${index * 0.05}s` }}>
              <div className="sport-card-bg"></div>
              <div className="sport-card-content">
                <div className="sport-icon-wrapper">
                  <span className="sport-icon-large">{sport.icon}</span>
                </div>
                <h3 className="sport-card-name">{sport.name}</h3>
                <span className="sport-card-arrow">→</span>
              </div>
              <div className="sport-card-shine"></div>
            </Link>
          ))}
        </div>
      </section>

      {/* ===== UPCOMING MATCHES ===== */}
      {upcomingMatches.length > 0 && (
        <section className="section container">
          <div className="section-header">
            <div className="section-tag">MARK YOUR CALENDAR</div>
            <h2 className="section-title">Upcoming Matches</h2>
          </div>
          <div className="upcoming-grid">
            {upcomingMatches.map((match) => (
              <div key={match.id} className="upcoming-card">
                <div className="upcoming-card-top">
                  <span className="match-badge upcoming-badge">UPCOMING</span>
                  <span className="match-sport-tag">{match.sport_id.replace('-', ' ').toUpperCase()}</span>
                </div>
                <div className="upcoming-teams">
                  <span>{match.team1}</span>
                  <span className="upcoming-vs">VS</span>
                  <span>{match.team2}</span>
                </div>
                <div className="upcoming-time">
                  📅 {new Date(match.scheduled_time).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export default Home;
