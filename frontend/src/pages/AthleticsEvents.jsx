import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';

const EVENT_TYPES = {
  relay_4x100: { label: '4 × 100m Relay', icon: '🏃‍♂️🏃‍♀️', color: '#6366f1' },
  boys_100m:   { label: 'Boys 100m',       icon: '🏃‍♂️',     color: '#f59e0b' },
  girls_100m:  { label: 'Girls 100m',      icon: '🏃‍♀️',     color: '#ec4899' },
};

const getEventStatus = (event) => {
  if (event.status === 'completed') return { label: 'COMPLETED', color: '#34d399', background: 'rgba(52,211,153,0.12)', border: 'rgba(52,211,153,0.3)' };
  if ((event.entries || []).length > 0) return { label: 'LIVE', color: 'var(--color-primary)', background: 'rgba(255,26,26,0.12)', border: 'rgba(255,26,26,0.3)' };
  return { label: 'UPCOMING', color: '#f59e0b', background: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)' };
};

export default function AthleticsEvents() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all | relay_4x100 | boys_100m | girls_100m

  useEffect(() => {
    api.get('/athletics/events')
      .then(res => setEvents(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = filter === 'all' ? events : events.filter(e => e.event_type === filter);

  return (
    <div className="container" style={{ paddingTop: '2rem', paddingBottom: '4rem' }}>
      {/* Hero */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(245,158,11,0.08))',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '24px',
        padding: '3rem 2rem',
        textAlign: 'center',
        marginBottom: '2.5rem',
      }}>
        <div style={{ fontSize: '3.5rem', marginBottom: '0.75rem' }}>🏃</div>
        <h1 style={{ margin: '0 0 0.5rem', fontSize: '2.5rem', fontWeight: 900, letterSpacing: '-0.02em' }}>
          Athletics
        </h1>
        <p style={{ color: 'var(--color-text-muted)', margin: 0, fontSize: '1rem' }}>
          Time-based leaderboards for all running events
        </p>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
        {[{ value: 'all', label: 'All Events', icon: '📋' }, ...Object.entries(EVENT_TYPES).map(([v, m]) => ({ value: v, label: m.label, icon: m.icon }))].map(tab => (
          <button
            key={tab.value}
            onClick={() => setFilter(tab.value)}
            style={{
              padding: '0.5rem 1.2rem',
              border: `1px solid ${filter === tab.value ? 'var(--color-primary)' : 'rgba(255,255,255,0.12)'}`,
              borderRadius: '999px',
              background: filter === tab.value ? 'rgba(99,102,241,0.15)' : 'transparent',
              color: filter === tab.value ? 'var(--color-primary)' : 'var(--color-text-muted)',
              cursor: 'pointer',
              fontWeight: filter === tab.value ? 700 : 400,
              fontSize: '0.85rem',
              transition: 'all 0.15s',
            }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Event Cards */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--color-text-muted)' }}>
          Loading events...
        </div>
      ) : filtered.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '4rem',
          background: 'var(--color-surface)',
          border: '1px dashed rgba(255,255,255,0.12)',
          borderRadius: '16px',
          color: 'var(--color-text-muted)',
        }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>📋</div>
          <p>No events found. Check back later!</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.25rem' }}>
          {filtered.map(ev => {
            const meta = EVENT_TYPES[ev.event_type] || { label: ev.event_type, icon: '🏃', color: '#6366f1' };
            const entries = ev.entries || [];
            const leader = entries[0]; // already sorted by backend
            const status = getEventStatus(ev);

            return (
              <Link key={ev.id} to={`/athletics/${ev.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                <div style={{
                  background: 'var(--color-surface)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '16px',
                  overflow: 'hidden',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  cursor: 'pointer',
                }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 12px 40px rgba(0,0,0,0.3)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
                >
                  {/* Color Band */}
                  <div style={{ height: '4px', background: `linear-gradient(90deg, ${meta.color}, transparent)` }} />

                  <div style={{ padding: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem' }}>
                      <div>
                        <div style={{ fontSize: '1.6rem', marginBottom: '0.35rem' }}>{meta.icon}</div>
                        <div style={{ fontWeight: 800, fontSize: '1.05rem', marginBottom: '0.25rem' }}>
                          {ev.label || meta.label}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                          {meta.label}
                        </div>
                      </div>
                      <span style={{
                        padding: '0.3rem 0.8rem',
                        borderRadius: '999px',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        background: status.background,
                        color: status.color,
                        border: `1px solid ${status.border}`,
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                      }}>
                        {status.label}
                      </span>
                    </div>

                    {/* Stats */}
                    <div style={{
                      marginTop: '1.25rem',
                      paddingTop: '1rem',
                      borderTop: '1px solid rgba(255,255,255,0.06)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '0.82rem',
                    }}>
                      <span style={{ color: 'var(--color-text-muted)' }}>
                        👤 {entries.filter(e => !e.is_disqualified).length} participants
                      </span>
                      {leader && leader.time_sec > 0 && (
                        <span style={{ fontFamily: 'monospace', color: '#f59e0b', fontWeight: 700 }}>
                          🥇 {Number(leader.time_sec).toFixed(3)}s
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
