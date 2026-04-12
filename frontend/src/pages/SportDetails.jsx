import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api';
import { getSportMeta } from '../sports/sportsConfig';
import SportScoreboard from '../components/SportScoreboard';
import { useMatchSocket } from '../hooks/useMatchSocket';
import './SportDetails.css';

function SportDetails() {
  const { id } = useParams();
  const [matches, setMatches] = useState([]);
  const [teams, setTeams] = useState([]);
  const [activeTab, setActiveTab] = useState('matches');

  const getMatchRoute = (match) => (
    ['cricket', 'volleyball'].includes(match.sport_id)
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
  }, [id]);

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

  return (
    <div className="container sport-details-page">
      <div className="sd-hero">
        <div className="sd-hero-icon">{meta.icon}</div>
        <h1 className="sd-hero-title">{meta.name}</h1>
      </div>

      <div className="sd-tabs">
        <button 
          className={`sd-tab-btn ${activeTab === 'matches' ? 'active' : ''}`} 
          onClick={() => setActiveTab('matches')}
        >
          Matches
        </button>
        <button 
          className={`sd-tab-btn ${activeTab === 'teams' ? 'active' : ''}`} 
          onClick={() => setActiveTab('teams')}
        >
          Teams & Leaderboard
        </button>
      </div>

      {activeTab === 'matches' && (
        <div className="live-matches-grid">
          {matches.map((match) => {
            const cardContent = (
              <div className={`sd-match-card ${match.status === 'live' ? 'live' : ''}`}>
                <div className="sd-match-header">
                  <span className={`sd-match-status ${match.status === 'live' ? 'live' : ''}`}>
                    {match.status === 'live' ? '● LIVE' : match.status.toUpperCase()}
                  </span>
                  <span>{new Date(match.scheduled_time).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <SportScoreboard match={match} compact />
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
          {matches.length === 0 && <div className="empty-state-premium">No matches scheduled for {meta.name} yet.</div>}
        </div>
      )}

      {activeTab === 'teams' && (
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
              {/* Note: Dummy sorting by points */}
              {teams.sort((a, b) => b.points - a.points).map((team, index) => (
                <tr key={team.id}>
                  <td className={`sd-rank-${index + 1}`}>{index + 1}</td>
                  <td className="sd-team-name">{team.name}</td>
                  <td><span className="sd-points-badge">{team.points}</span></td>
                </tr>
              ))}
              {teams.length === 0 && <tr><td colSpan="3" style={{ textAlign: 'center', padding: '2rem' }}>No teams registered for {meta.name}.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default SportDetails;
