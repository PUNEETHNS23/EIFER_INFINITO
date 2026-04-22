import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';

export default function WeightliftingEvents() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/weightlifting/events')
      .then(res => setEvents(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="container" style={{ paddingTop: '2rem', paddingBottom: '4rem' }}>
      {/* Hero */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(167,139,250,0.15), rgba(245,158,11,0.08))',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '24px', padding: '3rem 2rem', textAlign: 'center', marginBottom: '2.5rem',
      }}>
        <div style={{ fontSize: '3.5rem', marginBottom: '0.75rem' }}>🏋️</div>
        <h1 style={{ margin: '0 0 0.5rem', fontSize: '2.5rem', fontWeight: 900, letterSpacing: '-0.02em' }}>
          Weight Lifting
        </h1>
        <p style={{ color: 'var(--color-text-muted)', margin: 0, fontSize: '1rem' }}>
          Squat · Bench Press · Dead Lift — 3 attempts each · Highest total wins
        </p>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--color-text-muted)' }}>Loading events...</div>
      ) : events.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem', background: 'var(--color-surface)', border: '1px dashed rgba(255,255,255,0.12)', borderRadius: '16px', color: 'var(--color-text-muted)' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>📋</div>
          <p>No events yet. Check back later!</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))', gap: '1.25rem' }}>
          {events.map(ev => {
            const entries = ev.entries || [];
            const validEntries = entries.filter(e => !e.is_disqualified && e.total > 0);
            const leader = validEntries[0];
            const isCompleted = ev.status === 'completed';
            return (
              <Link key={ev.id} to={`/weightlifting/${ev.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                <div
                  style={{
                    background: 'var(--color-surface)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '16px', overflow: 'hidden', transition: 'transform 0.2s, box-shadow 0.2s', cursor: 'pointer',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 12px 40px rgba(0,0,0,0.3)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
                >
                  <div style={{ height: '4px', background: 'linear-gradient(90deg, #a78bfa, #f59e0b, transparent)' }} />
                  <div style={{ padding: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem' }}>
                      <div>
                        <div style={{ fontSize: '1.6rem', marginBottom: '0.35rem' }}>🏋️</div>
                        <div style={{ fontWeight: 800, fontSize: '1.05rem', marginBottom: '0.25rem' }}>
                          {ev.label || 'Powerlifting Event'}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Squat + Bench + Deadlift</div>
                      </div>
                      <span style={{
                        padding: '0.3rem 0.8rem', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 700,
                        background: isCompleted ? 'rgba(52,211,153,0.12)' : 'rgba(245,158,11,0.12)',
                        color: isCompleted ? '#34d399' : '#f59e0b',
                        border: `1px solid ${isCompleted ? 'rgba(52,211,153,0.3)' : 'rgba(245,158,11,0.3)'}`,
                        whiteSpace: 'nowrap', flexShrink: 0,
                      }}>
                        {isCompleted ? '🔒 Final' : '⏳ Live'}
                      </span>
                    </div>
                    <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                      <span style={{ color: 'var(--color-text-muted)' }}>
                        👤 {entries.filter(e => !e.is_disqualified).length} lifters
                      </span>
                      {leader && (
                        <span style={{ fontFamily: 'monospace', color: '#a78bfa', fontWeight: 700 }}>
                          🥇 {leader.total?.toFixed(1)} kg
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
