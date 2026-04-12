import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api';
import { useMatchSocket } from '../hooks/useMatchSocket';
import SportScoreboard from '../components/SportScoreboard';
import './MatchDetails.css';

function MatchDetailsVolleyball() {
  const { id } = useParams();
  const [match, setMatch] = useState(null);
  const [team1Data, setTeam1Data] = useState(null);
  const [team2Data, setTeam2Data] = useState(null);
  const [activeTab, setActiveTab] = useState('scoreboard');

  useEffect(() => {
    const fetchMatch = async () => {
      try {
        const res = await api.get('/matches');
        const found = res.data.find(m => String(m.id) === id);
        if (found) {
          setMatch(found);
          const teamsRes = await api.get('/teams');
          setTeam1Data(teamsRes.data.find(t => t.id === found.team1_id));
          setTeam2Data(teamsRes.data.find(t => t.id === found.team2_id));
        }
      } catch (err) {
        console.error('Failed to fetch match details', err);
      }
    };
    fetchMatch();
  }, [id]);

  useMatchSocket((updatedMatch) => {
    if (String(updatedMatch.id) === id) {
      setMatch(updatedMatch);
    }
  });

  if (!match) return (
    <div className="container" style={{ padding: '4rem 1rem', textAlign: 'center' }}>
      <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🏐</div>
      <p>Loading Match Data...</p>
    </div>
  );

  const d = match.score_detail || {};

  return (
    <div className="match-details-container">
      
      {/* Back button */}
      <Link to={`/sport/volleyball`} className="match-back-link">
        ← Back to Volleyball
      </Link>

      {/* Header */}
      <div className="match-header-section">
        <div className="match-header-glow" style={{ background: 'var(--color-primary)' }}></div>
        
        <div className="match-header-content">
          <div>
            <h2 className="match-header-title">{match.team1} vs {match.team2}</h2>
            <div className="match-header-meta">
              <span>📍 {d.venue || 'TBD'}</span>
              <span>•</span>
              <span>🏆 {d.max_sets ? `Best of ${d.max_sets} Sets` : 'Tournament Match'}</span>
              <span>•</span>
              <span>📅 {new Date(match.scheduled_time).toLocaleDateString()}</span>
            </div>
          </div>
          <div className={`match-status-badge match-status-${match.status}`}>
            {match.status}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="match-tabs-container">
        {['scoreboard', 'squads', 'info'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`match-tab-btn ${activeTab === tab ? 'active' : ''}`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="match-content-card">
        
        {activeTab === 'scoreboard' && (
          <div style={{ animation: 'fadeIn 0.4s ease-out' }}>
            <SportScoreboard match={match} />
            
            {d.setHistory && d.setHistory.length > 0 && (
              <div style={{ marginTop: '2.5rem' }}>
                <h3 className="admin-section-title" style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '1.5rem' }}>Set Summaries</h3>
                <div style={{ display: 'grid', gap: '0.75rem' }}>
                  {d.setHistory.map((s, idx) => (
                    <div key={idx} className="match-info-item" style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}>
                      <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>SET {idx + 1}</span>
                      <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                        <span style={{ color: s.scoreA > s.scoreB ? 'var(--color-primary)' : 'inherit', fontWeight: 800, fontSize: '1.1rem' }}>{s.scoreA}</span>
                        <span style={{ opacity: 0.3 }}>-</span>
                        <span style={{ color: s.scoreB > s.scoreA ? 'var(--color-primary)' : 'inherit', fontWeight: 800, fontSize: '1.1rem' }}>{s.scoreB}</span>
                      </div>
                      <span style={{ fontSize: '0.75rem', background: 'rgba(255,255,255,0.05)', padding: '0.25rem 0.5rem', borderRadius: '4px', textAlign: 'right' }}>
                        Winner: <span style={{ display: 'block', fontWeight: 'bold' }}>{s.scoreA > s.scoreB ? match.team1 : match.team2}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'squads' && (
          <div className="match-squad-grid" style={{ animation: 'fadeIn 0.4s ease-out' }}>
            {[
              { name: match.team1, data: team1Data, color: '#ff6b35' },
              { name: match.team2, data: team2Data, color: '#00e5ff' }
            ].map(({ name, data, color }) => (
              <div key={name}>
                <h4 style={{ color, marginBottom: '1.25rem', fontSize: '1.2rem', fontFamily: 'var(--font-heading)' }}>{name}</h4>
                <div className="admin-squad-list">
                  {data?.squad?.sort((a,b) => a.is_substitute - b.is_substitute).map((p, i) => (
                    <div key={i} className="admin-squad-item" style={{ padding: '0.75rem 0' }}>
                      <span style={{ fontSize: '0.9rem', fontWeight: p.is_substitute ? 400 : 600, opacity: p.is_substitute ? 0.6 : 1 }}>{p.name}</span>
                      {p.is_substitute && <span style={{ fontSize: '0.65rem', color: 'var(--color-primary)', fontWeight: 800 }}>SUB</span>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'info' && (
          <div style={{ animation: 'fadeIn 0.4s ease-out' }}>
             <h3 className="admin-section-title" style={{ fontSize: '1.1rem', marginBottom: '1.5rem' }}>Tournament Details</h3>
             <div className="match-info-grid">
               <div className="match-info-item">
                 <p style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Venue</p>
                 <p style={{ fontSize: '1.1rem', fontWeight: 600 }}>{d.venue || 'No venue specified'}</p>
               </div>
               <div className="match-info-item">
                 <p style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Match Format</p>
                 <p style={{ fontSize: '1.1rem', fontWeight: 600 }}>Volleyball Best of {d.max_sets || 5} Sets</p>
               </div>
               <div className="match-info-item">
                 <p style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Scheduled Time</p>
                 <p style={{ fontSize: '1.1rem', fontWeight: 600 }}>{new Date(match.scheduled_time).toLocaleString()}</p>
               </div>
             </div>
          </div>
        )}

      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

export default MatchDetailsVolleyball;
