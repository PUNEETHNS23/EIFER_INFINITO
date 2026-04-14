import React, { useState, useEffect } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import api from '../api';
import { getSportMeta, CATEGORY_SPORTS, getSportCategories } from '../sports/sportsConfig';
import SportScoreboard from '../components/SportScoreboard';
import { useMatchSocket } from '../hooks/useMatchSocket';
import './SportDetails.css';

function SportDetails() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const [matches, setMatches] = useState([]);
  const [teams, setTeams] = useState([]);
  const [activeTab, setActiveTab] = useState(id === 'weight-lifting' ? 'teams' : 'matches');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedMatch, setSelectedMatch] = useState(null); // For Athletics detail modal
  const [allTeams, setAllTeams] = useState([]); // Cross-sport teams for resolving IDs

  const categorizedSports = Object.keys(CATEGORY_SPORTS);
  const isCategorizedSport = categorizedSports.includes(id);

  const normalizeCategory = (value) => (typeof value === 'string' ? value.trim() : '');
  const initialCategory = isCategorizedSport ? normalizeCategory(searchParams.get('subcategory')) : '';

  const getMatchRoute = (match) => (
    ['cricket', 'volleyball', 'football'].includes(match.sport_id)
      ? `/match/${match.id}`
      : `/sport/${match.sport_id}`
  );

  const fetchTeamsForSport = async () => {
    try {
      const teamsRes = await api.get(`/teams/sport/${id}`);
      setTeams(teamsRes.data);
    } catch (err) {
      console.error('Failed to fetch sport teams', err);
    }
  };

  useEffect(() => {
    setSelectedCategory(initialCategory);

    const fetchDetails = async () => {
      try {
        const matchesRes = await api.get(`/matches/sport/${id}`);
        setMatches(matchesRes.data);

        await fetchTeamsForSport();

        if (id === 'athletics') {
          const allTeamsRes = await api.get('/teams');
          setAllTeams(allTeamsRes.data);
        }
      } catch (err) {
        console.error('Failed to fetch sport details', err);
      }
    };
    fetchDetails();
  }, [id, initialCategory]);

  useMatchSocket((updatedMatch) => {
    if (updatedMatch.sport_id === id) {
      setMatches((prev) => {
        const idx = prev.findIndex((m) => m.id === updatedMatch.id);
        if (idx >= 0) {
          const arr = [...prev];
          arr[idx] = updatedMatch;
          return arr;
        }
        return [...prev, updatedMatch];
      });
      fetchTeamsForSport();
    }
  });

  const meta = getSportMeta(id);

  // Athletics: map event_type back to display category label — defined first so filteredMatches can use it
  const eventTypeToCategory = (et) => {
    if (et === 'boys_100m') return 'Boys 100 meter run';
    if (et === 'girls_100m') return 'Girls 100 meter run';
    if (et === 'relay_4x100') return '4 X 100 meter run';
    return et;
  };
  const eventTypeLabels = { boys_100m: 'Boys 100m', girls_100m: 'Girls 100m', relay_4x100: '4 × 100m Relay' };

  const filteredMatches = id === 'athletics'
    ? (selectedCategory
        ? matches.filter(m => m.score_detail?.event_type && eventTypeToCategory(m.score_detail.event_type) === selectedCategory)
        : matches)
    : isCategorizedSport
      ? (selectedCategory
          ? matches.filter((match) => normalizeCategory(match?.score_detail?.category) === selectedCategory)
          : matches)
      : matches;

  const filteredTeams = isCategorizedSport
    ? (selectedCategory
        ? teams.filter((team) => normalizeCategory(team?.category) === selectedCategory)
        : teams)
    : teams;


  return (
    <div className="container sport-details-page">
      <div className="sd-hero">
        <div className="sd-hero-icon">{meta.icon}</div>
        <h1 className="sd-hero-title">{meta.name}</h1>
      </div>

      {isCategorizedSport && (
        <div className="sd-category-selector">
          <h3 className="sd-category-title">Select Subcategory</h3>
          <div className="sd-category-options">
            <button
              className={`sd-category-btn ${selectedCategory === '' ? 'active' : ''}`}
              onClick={() => setSelectedCategory('')}
            >
              All Categories
            </button>
            {getSportCategories(id).map((category) => (
              <button
                key={category}
                className={`sd-category-btn ${selectedCategory === category ? 'active' : ''}`}
                onClick={() => setSelectedCategory(category)}
              >
                {category}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="sd-tabs">
        {id !== 'weight-lifting' && (
          <button 
            className={`sd-tab-btn ${activeTab === 'matches' ? 'active' : ''}`} 
            onClick={() => setActiveTab('matches')}
          >
            Matches
          </button>
        )}
        <button 
          className={`sd-tab-btn ${activeTab === 'teams' ? 'active' : ''}`} 
          onClick={() => setActiveTab('teams')}
        >
          {id === 'weight-lifting' ? 'Leaderboard' : 'Teams & Leaderboard'}
        </button>
      </div>

      {activeTab === 'matches' && (
        <div className="live-matches-grid">


          {filteredMatches.map((match) => {
            const team1Data = teams.find((team) => team.id === match.team1_id) || null;
            const team2Data = teams.find((team) => team.id === match.team2_id) || null;
            const isAthletics = id === 'athletics';
            const cardContent = (
              <div className={`sd-match-card ${match.status === 'live' ? 'live' : ''}`} 
                style={isAthletics ? { cursor: 'pointer' } : undefined}
                onClick={isAthletics ? () => setSelectedMatch(match) : undefined}
              >
                <div className="sd-match-header">
                  <span className={`sd-match-status ${(!isAthletics && match.status === 'live') ? 'live' : ''}`}>
                    {(!isAthletics && match.status === 'live') ? '● LIVE' : match.status.toUpperCase()}
                  </span>
                  <span>{new Date(match.scheduled_time).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                {isCategorizedSport && !isAthletics && (
                  <div className="sd-match-category-chip">{normalizeCategory(match?.score_detail?.category) || selectedCategory}</div>
                )}
                <SportScoreboard match={match} compact team1Data={team1Data} team2Data={team2Data} />
              </div>
            );

            return (
              <div key={match.id} className="sd-match-card-wrapper">
                {isAthletics ? cardContent : (
                  <Link to={getMatchRoute(match)} style={{ textDecoration: 'none', color: 'inherit' }}>
                    {cardContent}
                  </Link>
                )}
              </div>
            );
          })}
          {filteredMatches.length === 0 && (
            <div className="empty-state-premium">
              No matches scheduled for {meta.name} {selectedCategory ? `- ${selectedCategory}` : ''} yet.
            </div>
          )}
        </div>
      )}

      {activeTab === 'teams' && (() => {
        if (id === 'weight-lifting') {
          const participants = filteredTeams.map(team => {
            const res = team.results || {};
            return {
              ...team,
              squat: parseFloat(res.squat) || 0,
              bench: parseFloat(res.bench) || 0,
              deadlift: parseFloat(res.deadlift) || 0,
              total: parseFloat(res.total) || 0,
              is_injured: !!res.is_injured,
              is_disqualified: !!res.is_disqualified,
            };
          }).sort((a, b) => {
            // DQ'd last, then injured, then by total descending
            if (a.is_disqualified !== b.is_disqualified) return a.is_disqualified ? 1 : -1;
            if (a.is_injured !== b.is_injured) return a.is_injured ? 1 : -1;
            return b.total - a.total;
          });

          const statusBadge = (p) => {
            if (p.is_disqualified) return <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#ff4444', background: 'rgba(255,68,68,0.1)', padding: '2px 6px', borderRadius: '4px' }}>DQ'd</span>;
            if (p.is_injured) return <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#f59e0b', background: 'rgba(245,158,11,0.1)', padding: '2px 6px', borderRadius: '4px' }}>Injured</span>;
            return <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>Active</span>;
          };

          return (
            <div className="sd-table-card">
              {participants.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-muted)' }}>
                  No participants have been entered yet.
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="sd-table" style={{ minWidth: '650px' }}>
                    <thead>
                      <tr>
                        <th>Rank</th>
                        <th>Participant</th>
                        <th>🟥 Squat</th>
                        <th>🟦 Bench</th>
                        <th>⬛ Deadlift</th>
                        <th style={{ color: '#a78bfa', fontWeight: 700 }}>⚡ Total</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {participants.map((p, index) => (
                        <tr key={p.id} style={{ opacity: (p.is_injured || p.is_disqualified) ? 0.6 : 1, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                          <td className={`sd-rank-${Math.min(index + 1, 3)}`}>{index + 1}</td>
                          <td className="sd-team-name">{p.name}</td>
                          <td>{p.squat > 0 ? `${p.squat} kg` : '—'}</td>
                          <td>{p.bench > 0 ? `${p.bench} kg` : '—'}</td>
                          <td>{p.deadlift > 0 ? `${p.deadlift} kg` : '—'}</td>
                          <td><span className="sd-points-badge" style={{ background: 'rgba(167,139,250,0.15)', color: '#a78bfa' }}>{p.total > 0 ? `${p.total.toFixed(1)} kg` : '—'}</span></td>
                          <td>{statusBadge(p)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        }

        // Default leaderboard for other sports
        return (
          <div className="sd-table-card">
            <table className="sd-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Team</th>
                  <th>Points</th>
                </tr>
              </thead>
              <tbody>
                {filteredTeams.sort((a, b) => b.points - a.points).map((team, index) => (
                  <tr key={team.id}>
                    <td className={`sd-rank-${index + 1}`}>{index + 1}</td>
                    <td className="sd-team-name">{team.name}</td>
                    <td><span className="sd-points-badge">{team.points}</span></td>
                  </tr>
                ))}
                {filteredTeams.length === 0 && (
                  <tr>
                    <td colSpan="3" style={{ textAlign: 'center', padding: '2rem' }}>
                      No teams registered for {meta.name} {selectedCategory ? `- ${selectedCategory}` : ''}.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        );
      })()}

      {/* Athletics Match Detail Modal */}
      {selectedMatch && id === 'athletics' && (() => {
        const m = selectedMatch;
        const d = m.score_detail || {};
        const participants = d.participants || [];
        const eventLabel = eventTypeLabels[d.event_type] || d.event_type || 'Event';
        const qualifierCount = d.qualifier_count || null;
        const sortedParticipants = [...participants].sort((a, b) => {
          if (!a.rank && !b.rank) return 0;
          if (!a.rank) return 1;
          if (!b.rank) return -1;
          return a.rank - b.rank;
        });
        const hasResults = participants.some(p => p.rank);
        return (
          <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
            onClick={() => setSelectedMatch(null)}
          >
            <div
              style={{ background: 'var(--color-surface, #1a1a2e)', borderRadius: '16px', width: '100%', maxWidth: '640px', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)' }}
              onClick={e => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontSize: '1.4rem' }}>🏃</span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                    <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>{eventLabel}</h2>
                    {d.is_final && (
                      <span style={{ fontSize: '0.7rem', fontWeight: 800, background: '#fbbf24', color: '#000', padding: '2px 8px', borderRadius: '4px', letterSpacing: '0.08em' }}>FINAL</span>
                    )}
                    <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '4px', fontWeight: 700, background: m.status === 'completed' ? 'rgba(52,211,153,0.15)' : 'rgba(255,255,255,0.08)', color: m.status === 'completed' ? '#34d399' : 'var(--color-text-muted)', marginLeft: 'auto' }}>
                      {m.status === 'completed' ? 'COMPLETED' : 'UPCOMING'}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: '0.2rem' }}>
                    {new Date(m.scheduled_time).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    {qualifierCount && ` · Top ${qualifierCount} qualify`}
                  </div>
                </div>
                <button onClick={() => setSelectedMatch(null)} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', fontSize: '1.4rem', cursor: 'pointer', lineHeight: 1 }}>✕</button>
              </div>

              <div style={{ padding: '1.5rem' }}>
                {/* Participants count */}
                <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1.5rem' }}>
                  <div style={{ flex: 1, padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.04)', borderRadius: '10px', textAlign: 'center' }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{participants.length}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.2rem' }}>Participants</div>
                  </div>
                  {qualifierCount && (
                    <div style={{ flex: 1, padding: '0.75rem 1rem', background: 'rgba(52,211,153,0.07)', borderRadius: '10px', textAlign: 'center', border: '1px solid rgba(52,211,153,0.15)' }}>
                      <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#34d399' }}>{qualifierCount}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.2rem' }}>Qualifiers</div>
                    </div>
                  )}
                  {hasResults && (
                    <div style={{ flex: 1, padding: '0.75rem 1rem', background: 'rgba(251,191,36,0.06)', borderRadius: '10px', textAlign: 'center', border: '1px solid rgba(251,191,36,0.12)' }}>
                      <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fbbf24' }}>{participants.filter(p => p.qualified).length}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.2rem' }}>Qualified</div>
                    </div>
                  )}
                </div>

                {/* Match Results Leaderboard */}
                <h3 style={{ margin: '0 0 0.75rem', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)' }}>
                  {hasResults ? '🏆 Match Results' : '👥 Registered Teams'}
                </h3>
                <div style={{ borderRadius: '10px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                    <thead>
                      <tr style={{ background: 'rgba(255,255,255,0.05)' }}>
                        <th style={{ padding: '0.6rem 1rem', textAlign: 'left', fontSize: '0.76rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Rank</th>
                        <th style={{ padding: '0.6rem 1rem', textAlign: 'left', fontSize: '0.76rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Team</th>
                        <th style={{ padding: '0.6rem 1rem', textAlign: 'center', fontSize: '0.76rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Time</th>
                        <th style={{ padding: '0.6rem 1rem', textAlign: 'center', fontSize: '0.76rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(hasResults ? sortedParticipants : participants).map((p, idx) => {
                        const teamObj = allTeams.find(t => String(t.id) === String(p.team_id));
                        const teamName = teamObj?.name || `Team ${p.team_id}`;
                        const squad = teamObj?.squad || [];
                        const rankColors = { 1: '#fbbf24', 2: '#94a3b8', 3: '#cd7f32' };
                        const rankColor = rankColors[p.rank] || 'rgba(255,255,255,0.2)';
                        const pos = hasResults ? (p.rank || '—') : (idx + 1);
                        return (
                          <tr key={p.team_id} style={{ borderTop: '1px solid rgba(255,255,255,0.06)', background: p.qualified ? 'rgba(52,211,153,0.04)' : 'transparent' }}>
                            <td style={{ padding: '0.7rem 1rem' }}>
                              <div style={{ width: '26px', height: '26px', background: rankColor, color: p.rank <= 3 ? '#000' : 'var(--color-text-muted)', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.8rem' }}>
                                {pos}
                              </div>
                            </td>
                            <td style={{ padding: '0.7rem 1rem' }}>
                              <div style={{ fontWeight: 600 }}>{teamName}</div>
                              {squad.length > 0 && (
                                <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: '0.15rem' }}>
                                  {squad.join(' · ')}
                                </div>
                              )}
                            </td>
                            <td style={{ padding: '0.7rem 1rem', textAlign: 'center', fontFamily: 'monospace', color: 'var(--color-primary)' }}>
                              {p.time > 0 ? `${Number(p.time).toFixed(3)}s` : '—'}
                            </td>
                            <td style={{ padding: '0.7rem 1rem', textAlign: 'center' }}>
                              {hasResults
                                ? p.qualified
                                  ? <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#34d399', background: 'rgba(52,211,153,0.1)', padding: '2px 7px', borderRadius: '4px' }}>Qualified ✅</span>
                                  : <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#f87171', background: 'rgba(248,113,113,0.08)', padding: '2px 7px', borderRadius: '4px' }}>Eliminated ❌</span>
                                : <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>Awaiting results</span>
                              }
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {!hasResults && (
                  <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.85rem', marginTop: '1rem' }}>
                    Results will appear here once the match is completed.
                  </p>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

export default SportDetails;
