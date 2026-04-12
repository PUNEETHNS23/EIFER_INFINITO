import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../api';
import { useMatchSocket } from '../hooks/useMatchSocket';
import SportScoreboard from '../components/SportScoreboard';

function MatchDetailsFootball() {
  const { id } = useParams();
  const [match, setMatch] = useState(null);
  const [team1Data, setTeam1Data] = useState(null);
  const [team2Data, setTeam2Data] = useState(null);
  const [activeTab, setActiveTab] = useState('scoreboard');

  useEffect(() => {
    const fetchMatch = async () => {
      try {
        const res = await api.get('/matches');
        const found = res.data.find((m) => String(m.id) === id);
        if (found) {
          setMatch(found);
          const teamsRes = await api.get('/teams');
          setTeam1Data(teamsRes.data.find((t) => t.id === found.team1_id));
          setTeam2Data(teamsRes.data.find((t) => t.id === found.team2_id));
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
    <div className="container" style={{ maxWidth: '820px', margin: '0 auto', padding: '1rem 1rem 4rem' }}>
      <div style={{ marginBottom: '1rem' }}>
        <Link to="/sport/football" style={{ color: 'var(--color-text-muted)', textDecoration: 'none', fontSize: '0.9rem' }}>
          ← Back to Football
        </Link>
      </div>

      <div
        style={{
          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.14) 0%, rgba(16, 185, 129, 0.03) 100%)',
          padding: '1.5rem',
          borderRadius: '16px 16px 0 0',
          borderBottom: '1px solid var(--color-border)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{ position: 'absolute', top: '-10%', right: '-5%', width: '150px', height: '150px', background: '#10b981', filter: 'blur(85px)', opacity: 0.12 }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', position: 'relative', zIndex: 1 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800 }}>{match.team1} vs {match.team2}</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>📍 {d.venue || 'TBD'}</span>
              <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>⏱️ {d.match_minutes || 90} mins</span>
              <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>📅 {new Date(match.scheduled_time).toLocaleDateString()}</span>
            </div>
          </div>
          <div
            style={{
              background: match.status === 'live' ? '#ff4d4d' : 'var(--color-border)',
              padding: '0.4rem 0.8rem',
              borderRadius: '99px',
              fontSize: '0.75rem',
              fontWeight: 800,
              color: '#fff',
              textTransform: 'uppercase',
            }}
          >
            {match.status}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', background: 'rgba(0,0,0,0.2)', padding: '0 0.5rem', borderBottom: '1px solid var(--color-border)', gap: '0.25rem' }}>
        {['scoreboard', 'squads', 'info'].map((tab) => (
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
              letterSpacing: '1px',
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      <div style={{ background: 'var(--color-surface)', padding: '2rem', borderRadius: '0 0 16px 16px', border: '1px solid var(--color-border)', borderTop: 'none', minHeight: '380px' }}>
        {activeTab === 'scoreboard' && (
          <div>
            <SportScoreboard match={match} />
          </div>
        )}

        {activeTab === 'squads' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
            {[
              { name: match.team1, data: team1Data, color: '#10b981' },
              { name: match.team2, data: team2Data, color: '#06b6d4' },
            ].map(({ name, data, color }) => (
              <div key={name}>
                <h4 style={{ color, marginBottom: '1rem', fontSize: '1.1rem' }}>{name}</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {data?.squad?.length ? (
                    data.squad
                      .sort((a, b) => a.is_substitute - b.is_substitute)
                      .map((p, idx) => (
                        <div
                          key={idx}
                          style={{
                            padding: '0.75rem 1rem',
                            background: p.is_substitute ? 'transparent' : 'rgba(255,255,255,0.03)',
                            borderRadius: '8px',
                            border: p.is_substitute ? '1px dashed rgba(255,255,255,0.12)' : '1px solid rgba(255,255,255,0.05)',
                            display: 'flex',
                            justifyContent: 'space-between',
                          }}
                        >
                          <span style={{ opacity: p.is_substitute ? 0.65 : 1 }}>{p.name}</span>
                          {p.is_substitute && <span style={{ fontSize: '0.68rem', fontWeight: 800 }}>SUB</span>}
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
          <div style={{ display: 'grid', gap: '1rem' }}>
            <div style={{ padding: '1rem 1.25rem', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', background: 'rgba(255,255,255,0.02)' }}>
              <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Venue</p>
              <p style={{ margin: '0.5rem 0 0', fontWeight: 700 }}>{d.venue || 'No venue specified'}</p>
            </div>
            <div style={{ padding: '1rem 1.25rem', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', background: 'rgba(255,255,255,0.02)' }}>
              <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Format</p>
              <p style={{ margin: '0.5rem 0 0', fontWeight: 700 }}>Football {d.match_minutes || 90}-minute match</p>
            </div>
            <div style={{ padding: '1rem 1.25rem', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', background: 'rgba(255,255,255,0.02)' }}>
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
