import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api';

const EVENT_LABELS = {
  relay_4x100: '4 × 100m Relay',
  boys_100m: 'Boys 100m',
  girls_100m: 'Girls 100m',
};

const EVENT_ICONS = {
  relay_4x100: '🏃‍♂️🏃‍♀️',
  boys_100m: '🏃‍♂️',
  girls_100m: '🏃‍♀️',
};

const RANK_STYLES = {
  1: { bg: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#000', medal: '🥇' },
  2: { bg: 'linear-gradient(135deg, #94a3b8, #64748b)', color: '#fff', medal: '🥈' },
  3: { bg: 'linear-gradient(135deg, #cd7f32, #a0522d)', color: '#fff', medal: '🥉' },
};

export default function AthleticsEventDetail() {
  const { eventId } = useParams();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get(`/athletics/events/${eventId}`);
        setEvent(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
    const interval = setInterval(load, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, [eventId]);

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--color-text-muted)' }}>
      <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>⏳</div>
      Loading event...
    </div>
  );

  if (!event) return (
    <div style={{ textAlign: 'center', padding: '4rem', color: '#ef4444' }}>
      Event not found.
    </div>
  );

  const entries = event.entries || [];
  const isCompleted = event.status === 'completed';
  const isLive = !isCompleted && entries.length > 0;
  const isRelay = event.event_type === 'relay_4x100';
  const label = event.label || EVENT_LABELS[event.event_type] || event.event_type;

  return (
    <div className="container" style={{ paddingTop: '2rem', paddingBottom: '4rem' }}>
      {/* Back */}
      <div style={{ marginBottom: '1.5rem' }}>
        <Link to="/sport/athletics" className="btn-outline btn-sm">← Back to Athletics</Link>
      </div>

      {/* Hero Header */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(16,185,129,0.1))',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '20px',
        padding: '2.5rem',
        marginBottom: '2rem',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>{EVENT_ICONS[event.event_type] || '🏃'}</div>
        <h1 style={{ margin: '0 0 0.5rem', fontSize: '2rem', fontWeight: 800 }}>{label}</h1>
        <div style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>
          {EVENT_LABELS[event.event_type]}
        </div>
        <span style={{
          display: 'inline-block',
          padding: '0.4rem 1.2rem',
          borderRadius: '999px',
          fontSize: '0.85rem',
          fontWeight: 700,
          background: isCompleted ? 'rgba(52,211,153,0.15)' : isLive ? 'rgba(255,26,26,0.15)' : 'rgba(245,158,11,0.15)',
          color: isCompleted ? '#34d399' : isLive ? 'var(--color-primary)' : '#f59e0b',
          border: `1px solid ${isCompleted ? 'rgba(52,211,153,0.3)' : isLive ? 'rgba(255,26,26,0.3)' : 'rgba(245,158,11,0.3)'}`,
          letterSpacing: '0.05em',
        }}>
          {isCompleted ? '🔒 COMPLETED' : isLive ? '🔴 LIVE' : '⏳ UPCOMING'}
        </span>
      </div>

      {/* Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        {[
          { label: 'Participants', value: entries.filter(e => !e.is_disqualified).length, icon: '👤' },
          { label: 'Disqualified', value: entries.filter(e => e.is_disqualified).length, icon: '⛔' },
          { label: 'With Time', value: entries.filter(e => !e.is_disqualified && e.time_sec > 0).length, icon: '⏱️' },
        ].map(s => (
          <div key={s.label} style={{
            background: 'var(--color-surface)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '12px',
            padding: '1.25rem',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '1.5rem', marginBottom: '0.35rem' }}>{s.icon}</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--color-primary)' }}>{s.value}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.2rem' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Leaderboard */}
      <div style={{
        background: 'var(--color-surface)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '16px',
        overflow: 'hidden',
      }}>
        <div style={{
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.6rem',
        }}>
          <span style={{ fontSize: '1.1rem' }}>🏆</span>
          <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Leaderboard</h2>
          <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
            Sorted by time (ascending)
          </span>
        </div>

        {entries.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--color-text-muted)' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>📋</div>
            No participants registered yet.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.92rem' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <th style={{ padding: '0.9rem 1rem', textAlign: 'left', fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em' }}>Rank</th>
                  <th style={{ padding: '0.9rem 1rem', textAlign: 'left', fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em' }}>
                    {isRelay ? 'Team' : 'Name'}
                  </th>
                  {isRelay && (
                    <th style={{ padding: '0.9rem 1rem', textAlign: 'left', fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em' }}>Players</th>
                  )}
                  <th style={{ padding: '0.9rem 1rem', textAlign: 'center', fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em' }}>⏱️ Time</th>
                  <th style={{ padding: '0.9rem 1rem', textAlign: 'center', fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, idx) => {
                  const rank = entry.rank;
                  const rankStyle = RANK_STYLES[rank];
                  const isDQ = entry.is_disqualified;
                  const hasTime = entry.time_sec > 0;

                  return (
                    <tr key={entry.id || idx} style={{
                      borderTop: '1px solid rgba(255,255,255,0.05)',
                      background: isDQ ? 'rgba(239,68,68,0.03)' : rank === 1 ? 'rgba(245,158,11,0.04)' : 'transparent',
                      opacity: isDQ ? 0.6 : 1,
                    }}>
                      {/* Rank */}
                      <td style={{ padding: '1rem' }}>
                        {isDQ ? (
                          <span style={{ padding: '0.25rem 0.6rem', background: 'rgba(239,68,68,0.15)', color: '#ef4444', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 700 }}>DQ</span>
                        ) : rank ? (
                          rankStyle ? (
                            <div style={{
                              width: '36px', height: '36px', borderRadius: '10px',
                              background: rankStyle.bg, color: rankStyle.color,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontWeight: 800, fontSize: '0.9rem', boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
                            }}>
                              {rankStyle.medal}
                            </div>
                          ) : (
                            <div style={{
                              width: '36px', height: '36px', borderRadius: '10px',
                              background: 'rgba(255,255,255,0.08)', color: 'var(--color-text-muted)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontWeight: 700, fontSize: '0.9rem'
                            }}>
                              {rank}
                            </div>
                          )
                        ) : (
                          <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>—</span>
                        )}
                      </td>

                      {/* Name/Team */}
                      <td style={{ padding: '1rem' }}>
                        <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{entry.team_name}</div>
                      </td>

                      {/* Players (relay only) */}
                      {isRelay && (
                        <td style={{ padding: '1rem' }}>
                          {entry.players && entry.players.length > 0 ? (
                            <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
                              {entry.players.join(' · ')}
                            </div>
                          ) : (
                            <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>—</span>
                          )}
                        </td>
                      )}

                      {/* Time */}
                      <td style={{ padding: '1rem', textAlign: 'center' }}>
                        {hasTime ? (
                          <span style={{
                            fontFamily: 'monospace', fontWeight: 700, fontSize: '1rem',
                            color: rank === 1 ? '#f59e0b' : rank === 2 ? '#94a3b8' : rank === 3 ? '#cd7f32' : 'var(--color-primary)',
                          }}>
                            {Number(entry.time_sec).toFixed(3)}s
                          </span>
                        ) : (
                          <span style={{ color: 'var(--color-text-muted)' }}>—</span>
                        )}
                      </td>

                      {/* Status */}
                      <td style={{ padding: '1rem', textAlign: 'center' }}>
                        {isDQ ? (
                          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#ef4444', background: 'rgba(239,68,68,0.1)', padding: '3px 8px', borderRadius: '6px' }}>Disqualified</span>
                        ) : rank === 1 ? (
                          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#f59e0b', background: 'rgba(245,158,11,0.1)', padding: '3px 8px', borderRadius: '6px' }}>🥇 Winner</span>
                        ) : (
                          <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>Active</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
