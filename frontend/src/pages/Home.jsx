import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import SportScoreboard from '../components/SportScoreboard';
import { SPORTS, CATEGORY_SPORTS } from '../sports/sportsConfig';
import { useMatchSocket } from '../hooks/useMatchSocket';
import './Home.css';

const LIVE_SPORT_PRIORITY = [
  'cricket',
  'volleyball',
  'football',
  'badminton',
  'table-tennis',
];

const getLiveSportPriorityIndex = (sportId) => {
  const idx = LIVE_SPORT_PRIORITY.indexOf(sportId);
  return idx === -1 ? LIVE_SPORT_PRIORITY.length : idx;
};

const sortLiveMatchesByPriority = (matches) => (
  [...matches].sort((a, b) => {
    const priorityDiff = getLiveSportPriorityIndex(a.sport_id) - getLiveSportPriorityIndex(b.sport_id);
    if (priorityDiff !== 0) return priorityDiff;

    const sportDiff = String(a.sport_id || '').localeCompare(String(b.sport_id || ''));
    if (sportDiff !== 0) return sportDiff;

    const aTime = new Date(a.scheduled_time || 0).getTime();
    const bTime = new Date(b.scheduled_time || 0).getTime();
    if (aTime !== bTime) return aTime - bTime;

    return String(a.id || '').localeCompare(String(b.id || ''));
  })
);

function Home() {
  const [liveMatches, setLiveMatches] = useState([]);
  const [recentlyCompletedMatches, setRecentlyCompletedMatches] = useState([]);
  const [upcomingMatches, setUpcomingMatches] = useState([]);
  const [upcomingAthleticsEvents, setUpcomingAthleticsEvents] = useState([]);
  const [teamCount, setTeamCount] = useState(null);
  const [matchCount, setMatchCount] = useState(null);
  const winnerHoldTimersRef = useRef({});

  const clearWinnerHoldTimer = (matchId) => {
    if (winnerHoldTimersRef.current[matchId]) {
      clearTimeout(winnerHoldTimersRef.current[matchId]);
      delete winnerHoldTimersRef.current[matchId];
    }
  };

  const scheduleWinnerHoldRemoval = (matchId) => {
    clearWinnerHoldTimer(matchId);
    winnerHoldTimersRef.current[matchId] = setTimeout(() => {
      setRecentlyCompletedMatches((prev) => prev.filter((m) => m.id !== matchId));
      delete winnerHoldTimersRef.current[matchId];
    }, 300000);
  };

  const getWinnerName = (match) => {
    const detail = match?.score_detail || {};
    const t1 = Number(match?.score_t1 ?? 0);
    const t2 = Number(match?.score_t2 ?? 0);
    if (t1 > t2) return match.team1;
    if (t2 > t1) return match.team2;

    const winner = String(detail.winner || '').toLowerCase();
    if (winner === 't1' || winner === 'team1') return match.team1;
    if (winner === 't2' || winner === 'team2') return match.team2;

    return 'Draw';
  };

  useEffect(() => {
    return () => {
      Object.values(winnerHoldTimersRef.current).forEach((timerId) => clearTimeout(timerId));
      winnerHoldTimersRef.current = {};
    };
  }, []);

  const getSubcategory = (match) => {
    if (!Object.keys(CATEGORY_SPORTS).includes(match.sport_id)) {
      return '';
    }
    const raw = match?.score_detail?.category;
    return typeof raw === 'string' ? raw.trim() : '';
  };

  const getMatchDetailsRoute = (match) => `/match/${match.id}`;

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [teamsRes, liveRes, allRes, athleticsRes] = await Promise.all([
          api.get('/teams'),
          api.get('/matches/live'),
          api.get('/matches'),
          api.get('/athletics/events'),
        ]);

        setTeamCount(Array.isArray(teamsRes.data) ? teamsRes.data.length : 0);
        setLiveMatches(Array.isArray(liveRes.data) ? liveRes.data : []);
        setMatchCount(Array.isArray(allRes.data) ? allRes.data.length : 0);
        setUpcomingMatches((Array.isArray(allRes.data) ? allRes.data : []).filter(m => m.status === 'upcoming').slice(0, 4));
        setUpcomingAthleticsEvents(
          (Array.isArray(athleticsRes.data) ? athleticsRes.data : [])
            .filter((event) => event.status !== 'completed')
            .slice(0, 4)
        );
      } catch (err) {
        console.error('Failed to fetch home data', err);
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

    if (updatedMatch.status === 'completed') {
      setRecentlyCompletedMatches((prev) => {
        const idx = prev.findIndex((m) => m.id === updatedMatch.id);
        if (idx >= 0) {
          const arr = [...prev];
          arr[idx] = updatedMatch;
          return arr;
        }
        return [...prev, updatedMatch];
      });
      scheduleWinnerHoldRemoval(updatedMatch.id);
    } else {
      clearWinnerHoldTimer(updatedMatch.id);
      setRecentlyCompletedMatches((prev) => prev.filter((m) => m.id !== updatedMatch.id));
    }
    
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

  const homeLiveDisplayMatches = sortLiveMatchesByPriority([
    ...liveMatches,
    ...recentlyCompletedMatches.filter((completed) => !liveMatches.some((live) => live.id === completed.id)),
  ]);

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
            <p className="hero-tag">EIFER SPORTS SOCIETY PRESENTS</p>
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
                <span className="hero-stat-number">{teamCount ?? '--'}</span>
                <span className="hero-stat-label">Teams</span>
              </div>
              <div className="hero-stat-divider"></div>
              <div className="hero-stat">
                <span className="hero-stat-number">{matchCount ?? '--'}</span>
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
          {homeLiveDisplayMatches.length > 0 ? (
            homeLiveDisplayMatches.map((match) => {
              const isWinnerHoldCard = match.status === 'completed';
              return (
              <div key={match.id} className={`match-card-live ${isWinnerHoldCard ? 'winner-hold-card' : ''}`}>
                <div className="match-card-live-glow"></div>
                {isWinnerHoldCard && (
                  <div className="winner-confetti-wrap" aria-hidden="true">
                    {Array.from({ length: 14 }).map((_, i) => (
                      <span key={i} className="winner-confetti-piece" />
                    ))}
                  </div>
                )}
                <div className="match-card-live-header">
                  {isWinnerHoldCard ? (
                    <span className="match-badge winner-badge">FINAL</span>
                  ) : (
                    <span className="match-badge live-badge"><span className="live-dot"></span>LIVE</span>
                  )}
                  <div className="match-sport-meta">
                    <span className="match-sport-tag">{match.sport_id.replace('-', ' ').toUpperCase()}</span>
                    {getSubcategory(match) && (
                      <span className="match-subcategory-tag">{getSubcategory(match)}</span>
                    )}
                  </div>
                </div>
                <div className="match-card-live-body">
                  <SportScoreboard match={match} compact />
                </div>
                {isWinnerHoldCard && (
                  <div className="winner-name-banner">
                    Winner: <strong>{getWinnerName(match)}</strong>
                  </div>
                )}
                <Link to={getMatchDetailsRoute(match)} className="match-card-live-link">
                  {isWinnerHoldCard ? 'View Result →' : 'Watch Details →'}
                </Link>
              </div>
            )})
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
      {(upcomingMatches.length > 0 || upcomingAthleticsEvents.length > 0) && (
        <section className="section container">
          <div className="section-header">
            <div className="section-tag">MARK YOUR CALENDAR</div>
            <h2 className="section-title">Upcoming</h2>
          </div>

          {upcomingMatches.length > 0 && (
            <>
              <div style={{ marginBottom: '1rem', color: 'var(--color-text-muted)', fontFamily: 'var(--font-ui)', letterSpacing: '1px', textTransform: 'uppercase', fontSize: '0.8rem' }}>
                Matches
              </div>
              <div className="upcoming-grid" style={{ marginBottom: upcomingAthleticsEvents.length > 0 ? '2rem' : 0 }}>
                {upcomingMatches.map((match) => (
                  <div key={match.id} className="upcoming-card">
                    <div className="upcoming-card-top">
                      <span className="match-badge upcoming-badge">UPCOMING</span>
                      <div className="match-sport-meta">
                        <span className="match-sport-tag">{match.sport_id.replace('-', ' ').toUpperCase()}</span>
                        {getSubcategory(match) && (
                          <span className="match-subcategory-tag">{getSubcategory(match)}</span>
                        )}
                      </div>
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
            </>
          )}

          {upcomingAthleticsEvents.length > 0 && (
            <>
              <div style={{ marginBottom: '1rem', color: 'var(--color-text-muted)', fontFamily: 'var(--font-ui)', letterSpacing: '1px', textTransform: 'uppercase', fontSize: '0.8rem' }}>
                Athletics Events
              </div>
              <div className="upcoming-grid">
                {upcomingAthleticsEvents.map((event) => {
                  const isCompleted = event.status === 'completed';
                  const isLive = !isCompleted && (event.entries || []).length > 0;
                  const statusLabel = isCompleted ? 'COMPLETED' : isLive ? 'LIVE' : 'UPCOMING';
                  const statusStyle = isCompleted
                    ? { background: 'rgba(52,211,153,0.12)', color: '#34d399', border: 'rgba(52,211,153,0.3)' }
                    : isLive
                      ? { background: 'rgba(255,26,26,0.12)', color: 'var(--color-primary)', border: 'rgba(255,26,26,0.3)' }
                      : { background: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: 'rgba(245,158,11,0.3)' };

                  return (
                    <Link key={event.id} to={`/athletics/${event.id}`} className="upcoming-card" style={{ display: 'block' }}>
                      <div className="upcoming-card-top">
                        <span className="match-badge" style={statusStyle}>{statusLabel}</span>
                        <div className="match-sport-meta">
                          <span className="match-sport-tag">ATHLETICS</span>
                          <span className="match-subcategory-tag">{(event.label || event.event_type).toUpperCase()}</span>
                        </div>
                      </div>
                      <div className="upcoming-teams" style={{ justifyContent: 'flex-start', gap: '0.75rem', flexWrap: 'wrap' }}>
                        <span>{event.label || event.event_type}</span>
                      </div>
                      <div className="upcoming-time">
                        👤 {(event.entries || []).filter((entry) => !entry.is_disqualified).length} participants
                      </div>
                    </Link>
                  );
                })}
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );
}

export default Home;
