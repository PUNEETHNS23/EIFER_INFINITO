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
  const filteredMatches = isCategorizedSport
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
            const cardContent = (
              <div className={`sd-match-card ${match.status === 'live' ? 'live' : ''}`}>
                <div className="sd-match-header">
                  <span className={`sd-match-status ${match.status === 'live' ? 'live' : ''}`}>
                    {match.status === 'live' ? '● LIVE' : match.status.toUpperCase()}
                  </span>
                  <span>{new Date(match.scheduled_time).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                {isCategorizedSport && (
                  <div className="sd-match-category-chip">{normalizeCategory(match?.score_detail?.category) || selectedCategory}</div>
                )}
                <SportScoreboard match={match} compact team1Data={team1Data} team2Data={team2Data} />
              </div>
            );

            return (
              <div key={match.id} className="sd-match-card-wrapper">
                <Link to={getMatchRoute(match)} style={{ textDecoration: 'none', color: 'inherit' }}>
                  {cardContent}
                </Link>
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
    </div>
  );
}

export default SportDetails;
