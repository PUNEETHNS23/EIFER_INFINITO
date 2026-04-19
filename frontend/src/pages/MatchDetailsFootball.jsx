import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../api';
import { useMatchSocket } from '../hooks/useMatchSocket';
import SportScoreboard from '../components/SportScoreboard';
import './MatchDetails.css';

function MatchDetailsFootball() {
  const { id } = useParams();
  const [match, setMatch] = useState(null);
  const [team1Data, setTeam1Data] = useState(null);
  const [team2Data, setTeam2Data] = useState(null);
  const [activeTab, setActiveTab] = useState('scoreboard');

  useEffect(() => {
    const fetchMatch = async () => {
      try {
        const found = (await api.get(`/matches/${id}`)).data;
        if (found) {
          const [team1Res, team2Res] = await Promise.all([
            api.get(`/teams/${found.team1_id}`),
            api.get(`/teams/${found.team2_id}`),
          ]);
          setMatch(found);
          setTeam1Data(team1Res.data || null);
          setTeam2Data(team2Res.data || null);
        }
      } catch (err) {
        console.error('Failed to fetch football match details', err);
      }
    };
    fetchMatch();
  }, [id]);

  useMatchSocket((updatedMatch) => {
    if (String(updatedMatch.id) === id) {
      setMatch(updatedMatch);
    }
  });

  if (!match) {
    return (
      <div className="container" style={{ padding: '4rem 1rem', textAlign: 'center' }}>
        <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>⚽</div>
        <p>Loading Match Data...</p>
      </div>
    );
  }

  const d = match.score_detail || {};

  return (
    <div className="match-details-container">
      <Link to="/sport/football" className="match-back-link">
        ← Back to Football
      </Link>

      <div className="match-header-section">
        <div className="match-header-glow" style={{ background: '#10b981' }}></div>
        <div className="match-header-content">
          <div>
            <h2 className="match-header-title">{match.team1} vs {match.team2}</h2>
            <div className="match-header-meta">
              <span>📍 {d.venue || 'TBD'}</span>
              <span>•</span>
              <span>⏱️ {d.match_minutes || 90} mins</span>
              <span>•</span>
              <span>📅 {new Date(match.scheduled_time).toLocaleDateString()}</span>
            </div>
          </div>
          <div className={`match-status-badge match-status-${match.status}`}>
            {match.status}
          </div>
        </div>
      </div>

      <div className="match-tabs-container">
        {['scoreboard', 'squads', 'info'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`match-tab-btn ${activeTab === tab ? 'active' : ''}`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="match-content-card">
        {activeTab === 'scoreboard' && (
          <div>
            <SportScoreboard match={match} />
          </div>
        )}

        {activeTab === 'squads' && (
          <div className="match-squad-grid">
            {[
              { name: match.team1, data: team1Data, color: '#10b981' },
              { name: match.team2, data: team2Data, color: '#06b6d4' },
            ].map(({ name, data, color }) => (
              <div key={name}>
                <h4 style={{ color, marginBottom: '1rem', fontSize: '1.2rem', fontFamily: 'var(--font-heading)' }}>{name}</h4>
                <div className="admin-squad-list">
                  {data?.squad?.length ? (
                    data.squad
                      .sort((a, b) => a.is_substitute - b.is_substitute)
                      .map((p, idx) => (
                        <div key={idx} className="admin-squad-item" style={{ padding: '0.75rem 0' }}>
                          <span style={{ opacity: p.is_substitute ? 0.65 : 1, fontWeight: p.is_substitute ? 'normal' : '600' }}>
                            {p.name}
                          </span>
                          {p.is_substitute && <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--color-text-muted)' }}>SUB</span>}
                        </div>
                      ))
                  ) : (
                    <p style={{ color: 'var(--color-text-muted)' }}>Squad not announced</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'info' && (
          <div className="match-info-grid">
            <div className="match-info-item">
              <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Venue</p>
              <p style={{ margin: '0.5rem 0 0', fontWeight: 700 }}>{d.venue || 'No venue specified'}</p>
            </div>
            <div className="match-info-item">
              <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Format</p>
              <p style={{ margin: '0.5rem 0 0', fontWeight: 700 }}>Football {d.match_minutes || 90}-minute match</p>
            </div>
            <div className="match-info-item">
              <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Scheduled Time</p>
              <p style={{ margin: '0.5rem 0 0', fontWeight: 700 }}>{new Date(match.scheduled_time).toLocaleString()}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default MatchDetailsFootball;
