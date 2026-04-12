import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api';
import { useMatchSocket } from '../hooks/useMatchSocket';
import SportScoreboard from '../components/SportScoreboard';

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
    <div className="container" style={{ maxWidth: '820px', margin: '0 auto', padding: '1rem 1rem 4rem' }}>
      
      {/* Back button */}
      <div style={{ marginBottom: '1rem' }}>
        <Link to={`/sport/volleyball`} style={{ color: 'var(--color-text-muted)', textDecoration: 'none', fontSize: '0.9rem' }}>
          ← Back to Volleyball
        </Link>
      </div>

      {/* Header */}
      <div style={{
        background: 'var(--color-surface)',
        padding: '1.5rem',
        borderRadius: '16px 16px 0 0',
        borderBottom: '1px solid var(--color-border)',
        background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(59, 130, 246, 0.02) 100%)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{ position: 'absolute', top: '-10%', right: '-5%', width: '150px', height: '150px', background: 'var(--color-primary)', filter: 'blur(80px)', opacity: 0.15 }}></div>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', position: 'relative', zIndex: 1 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800 }}>{match.team1} vs {match.team2}</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                📍 {d.venue || 'TBD'}
              </span>
              <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                🏆 {d.max_sets ? `Best of ${d.max_sets} Sets` : 'Tournament Match'}
              </span>
              <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                📅 {new Date(match.scheduled_time).toLocaleDateString()}
              </span>
            </div>
          </div>
          <div style={{
            background: match.status === 'live' ? '#ff4d4d' : 'var(--color-border)',
            padding: '0.4rem 0.8rem',
            borderRadius: '99px',
            fontSize: '0.75rem',
            fontWeight: 800,
            color: '#fff',
            textTransform: 'uppercase'
          }}>
            {match.status}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', background: 'rgba(0,0,0,0.2)', padding: '0 0.5rem', borderBottom: '1px solid var(--color-border)', gap: '0.25rem' }}>
        {['scoreboard', 'squads', 'info'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === tab ? '3px solid var(--color-primary)' : '3px solid transparent',
              color: activeTab === tab ? 'var(--color-text-main)' : 'var(--color-text-muted)',
              padding: '1rem 1.25rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              fontSize: '0.8rem',
              cursor: 'pointer',
              transition: 'all 0.2s',
              letterSpacing: '1px'
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ background: 'var(--color-surface)', padding: '2rem', borderRadius: '0 0 16px 16px', border: '1px solid var(--color-border)', borderTop: 'none', minHeight: '400px' }}>
        
        {activeTab === 'scoreboard' && (
          <div style={{ animation: 'fadeIn 0.4s ease-out' }}>
            <SportScoreboard match={match} />
            
            {d.setHistory && d.setHistory.length > 0 && (
              <div style={{ marginTop: '2.5rem' }}>
                <h3 style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '1rem' }}>Set Summaries</h3>
                <div style={{ display: 'grid', gap: '0.75rem' }}>
                  {d.setHistory.map((s, idx) => (
                    <div key={idx} style={{ 
                      background: 'rgba(255,255,255,0.03)', 
                      padding: '1rem', 
                      borderRadius: '12px', 
                      display: 'flex', 
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      border: '1px solid rgba(255,255,255,0.05)'
                    }}>
                      <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>SET {idx + 1}</span>
                      <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                        <span style={{ color: s.scoreA > s.scoreB ? 'var(--color-primary)' : 'inherit', fontWeight: 800, fontSize: '1.1rem' }}>{s.scoreA}</span>
                        <span style={{ opacity: 0.3 }}>-</span>
                        <span style={{ color: s.scoreB > s.scoreA ? 'var(--color-primary)' : 'inherit', fontWeight: 800, fontSize: '1.1rem' }}>{s.scoreB}</span>
                      </div>
                      <span style={{ fontSize: '0.75rem', background: 'rgba(255,255,255,0.05)', padding: '0.25rem 0.5rem', borderRadius: '4px' }}>
                        Winner: {s.scoreA > s.scoreB ? match.team1 : match.team2}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'squads' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', animation: 'fadeIn 0.4s ease-out' }}>
            {[
              { name: match.team1, data: team1Data, color: '#ff6b35' },
              { name: match.team2, data: team2Data, color: '#00e5ff' }
            ].map(({ name, data, color }) => (
              <div key={name}>
                <h4 style={{ color, marginBottom: '1.25rem', fontSize: '1.1rem', borderBottom: `2px solid ${color + '22'}`, paddingBottom: '0.5rem' }}>{name}</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {data?.squad?.sort((a,b) => a.is_substitute - b.is_substitute).map((p, i) => (
                    <div key={i} style={{ 
                      padding: '0.75rem 1rem', 
                      background: p.is_substitute ? 'transparent' : 'rgba(255,255,255,0.03)', 
                      borderRadius: '8px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      border: p.is_substitute ? '1px dashed rgba(255,255,255,0.1)' : '1px solid rgba(255,255,255,0.05)'
                    }}>
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
             <h3 style={{ fontSize: '1.1rem', marginBottom: '1.5rem' }}>Tournament Details</h3>
             <div style={{ display: 'grid', gap: '1.5rem' }}>
               <div style={{ padding: '1.5rem', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                 <p style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Venue</p>
                 <p style={{ fontSize: '1.1rem', fontWeight: 600 }}>{d.venue || 'No venue specified'}</p>
               </div>
               <div style={{ padding: '1.5rem', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                 <p style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Match Format</p>
                 <p style={{ fontSize: '1.1rem', fontWeight: 600 }}>Volleyball Best of {d.max_sets || 5} Sets</p>
               </div>
               <div style={{ padding: '1.5rem', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
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
