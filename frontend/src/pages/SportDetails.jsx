import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api';

function SportDetails() {
  const { id } = useParams();
  const [matches, setMatches] = useState([]);
  const [teams, setTeams] = useState([]);
  const [activeTab, setActiveTab] = useState('matches');

  useEffect(() => {
    const fetchDetails = async () => {
      try {
        const matchesRes = await api.get(`/matches/sport/${id}`);
        setMatches(matchesRes.data);
        
        const teamsRes = await api.get(`/teams/sport/${id}`);
        setTeams(teamsRes.data);
      } catch (err) {
        console.error('Failed to fetch sport details', err);
      }
    };
    fetchDetails();
  }, [id]);

  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title">{id.replace('-', ' ').toUpperCase()}</h1>
      </div>

      <div className="tabs" style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', borderBottom: '1px solid var(--color-border)' }}>
        <button 
          className={`nav-link ${activeTab === 'matches' ? 'active' : ''}`} 
          onClick={() => setActiveTab('matches')}
          style={{ borderBottom: activeTab === 'matches' ? '2px solid var(--color-primary)' : 'none', padding: '1rem' }}
        >
          Matches
        </button>
        <button 
          className={`nav-link ${activeTab === 'teams' ? 'active' : ''}`} 
          onClick={() => setActiveTab('teams')}
          style={{ borderBottom: activeTab === 'teams' ? '2px solid var(--color-primary)' : 'none', padding: '1rem' }}
        >
          Teams & Leaderboard
        </button>
      </div>

      {activeTab === 'matches' && (
        <div className="live-matches-grid">
          {matches.map((match) => (
            <div key={match.id} className={`card match-card ${match.status === 'live' ? 'live' : ''}`}>
              <div className="match-sport" style={{ color: match.status === 'live' ? 'var(--color-primary)' : 'var(--color-text-muted)' }}>
                {match.status.toUpperCase()}
              </div>
              <div className="match-teams" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}>
                <span className="team">{match.team1}</span>
                <span className="score">{match.score_t1} - {match.score_t2}</span>
                <span className="team">{match.team2}</span>
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '1rem' }}>
                {new Date(match.scheduled_time).toLocaleString()}
              </div>
            </div>
          ))}
          {matches.length === 0 && <div className="empty-state">No matches scheduled.</div>}
        </div>
      )}

      {activeTab === 'teams' && (
        <div className="card">
          <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                <th style={{ padding: '1rem' }}>Rank</th>
                <th style={{ padding: '1rem' }}>Team</th>
                <th style={{ padding: '1rem' }}>Points</th>
              </tr>
            </thead>
            <tbody>
              {/* Note: Dummy sorting by points */}
              {teams.sort((a, b) => b.points - a.points).map((team, index) => (
                <tr key={team.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '1rem', color: index === 0 ? 'var(--color-primary)' : 'inherit' }}>{index + 1}</td>
                  <td style={{ padding: '1rem', fontWeight: 'bold' }}>{team.name}</td>
                  <td style={{ padding: '1rem' }}>{team.points}</td>
                </tr>
              ))}
              {teams.length === 0 && <tr><td colSpan="3" style={{ padding: '1rem', textAlign: 'center' }}>No teams found.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default SportDetails;
