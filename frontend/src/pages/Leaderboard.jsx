import React, { useState, useEffect } from 'react';
import api from '../api';
import { useMatchSocket } from '../hooks/useMatchSocket';
import './Leaderboard.css';

function Leaderboard() {
  const [teams, setTeams] = useState([]);

  const fetchTeams = async () => {
    try {
      const res = await api.get('/teams');
      setTeams(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchTeams();
  }, []);

  useMatchSocket(() => {
    fetchTeams();
  });

  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title">OVERALL LEADERBOARD</h1>
        <p className="hero-subtitle">The Best of SportsFest INFINITO</p>
      </div>
      
      <div className="card leaderboard-table-card">
        <div className="table-responsive">
          <table className="leaderboard-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Team / Player</th>
                <th>Points</th>
              </tr>
            </thead>
            <tbody>
              {teams.sort((a, b) => b.points - a.points).map((team, index) => (
                <tr 
                  key={team.id} 
                  className={index < 3 ? `leaderboard-row-top-${index + 1}` : ''}
                >
                  <td>
                    <span className={`rank-text rank-${index + 1}`}>
                      {index + 1}
                    </span>
                  </td>
                  <td className="team-name-cell">{team.name}</td>
                  <td className="points-cell">{team.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default Leaderboard;
