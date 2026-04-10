import React, { useState, useEffect } from 'react';
import api from '../api';

function Leaderboard() {
  const [teams, setTeams] = useState([]);

  useEffect(() => {
    const fetchTeams = async () => {
      try {
        const res = await api.get('/teams');
        setTeams(res.data);
      } catch (e) {
        console.error(e);
      }
    };
    fetchTeams();
  }, []);

  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title">OVERALL LEADERBOARD</h1>
        <p className="hero-subtitle">The Best of SportsFest INFINITO</p>
      </div>
      <div className="card">
        <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
              <th style={{ padding: '1rem' }}>Rank</th>
              <th style={{ padding: '1rem' }}>Team / Player</th>
              <th style={{ padding: '1rem' }}>Sport</th>
              <th style={{ padding: '1rem' }}>Points</th>
            </tr>
          </thead>
          <tbody>
            {teams.sort((a, b) => b.points - a.points).map((team, index) => (
              <tr key={team.id} style={{ borderBottom: '1px solid var(--color-border)', background: index === 0 ? 'rgba(255, 215, 0, 0.1)' : 'transparent' }}>
                <td style={{ padding: '1rem', fontWeight: 'bold', color: index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? '#cd7f32' : 'inherit' }}>
                  {index + 1}
                </td>
                <td style={{ padding: '1rem', fontWeight: 'bold' }}>{team.name}</td>
                <td style={{ padding: '1rem', textTransform: 'capitalize' }}>{team.sport_id.replace('-', ' ')}</td>
                <td style={{ padding: '1rem', color: 'var(--color-primary)' }}>{team.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Leaderboard;
