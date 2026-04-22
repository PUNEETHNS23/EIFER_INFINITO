import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api';

const RANK_STYLES = {
  1: { bg: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#000', medal: '🥇' },
  2: { bg: 'linear-gradient(135deg, #94a3b8, #64748b)', color: '#fff', medal: '🥈' },
  3: { bg: 'linear-gradient(135deg, #cd7f32, #a0522d)', color: '#fff', medal: '🥉' },
};

function AttemptDots({ attempts }) {
  const arr = [...(attempts || [0, 0, 0])].slice(0, 3);
  const best = Math.max(...arr.filter(a => a > 0), 0);
  return (
    <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
      {arr.map((a, i) => (
        <span key={i} style={{
          padding: '0.25rem 0.5rem',
          borderRadius: '6px',
          fontSize: '0.8rem',
          fontFamily: 'monospace',
          fontWeight: a === best && a > 0 ? 700 : 400,
          background: a === best && a > 0 ? 'rgba(167,139,250,0.2)' : 'rgba(255,255,255,0.05)',
          color: a === best && a > 0 ? '#a78bfa' : a > 0 ? 'var(--color-text)' : 'var(--color-text-muted)',
          border: `1px solid ${a === best && a > 0 ? 'rgba(167,139,250,0.35)' : 'rgba(255,255,255,0.07)'}`,
        }}>
          {a > 0 ? `${a}` : '—'}
        </span>
      ))}
    </div>
  );
}

export default function WeightliftingEventDetail() {
  const { eventId } = useParams();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get(`/weightlifting/events/${eventId}`);
        setEvent(res.data);
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    load();
    const iv = setInterval(load, 30000);
    return () => clearInterval(iv);
  }, [eventId]);

  if (loading) return <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--color-text-muted)' }}>Loading...</div>;
  if (!event) return <div style={{ textAlign: 'center', padding: '4rem', color: '#ef4444' }}>Event not found.</div>;

  const entries = event.entries || [];
  const isCompleted = event.status === 'completed';
  const label = event.label || 'Powerlifting Event';

  return (
    <div className="container" style={{ paddingTop: '2rem', paddingBottom: '4rem' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <Link to="/sport/weight-lifting" className="btn-outline btn-sm">← Back to Weight Lifting</Link>
      </div>

      {/* Hero */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(167,139,250,0.12), rgba(245,158,11,0.08))',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '20px', padding: '2.5rem', marginBottom: '2rem', textAlign: 'center',
      }}>
        <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🏋️</div>
        <h1 style={{ margin: '0 0 0.5rem', fontSize: '2rem', fontWeight: 800 }}>{label}</h1>
        <p style={{ color: 'var(--color-text-muted)', margin: '0 0 1rem', fontSize: '0.9rem' }}>
          Squat + Bench Press + Dead Lift · Top total wins
        </p>
        <span style={{
          display: 'inline-block', padding: '0.4rem 1.2rem', borderRadius: '999px',
          fontSize: '0.85rem', fontWeight: 700,
          background: isCompleted ? 'rgba(52,211,153,0.15)' : 'rgba(245,158,11,0.15)',
          color: isCompleted ? '#34d399' : '#f59e0b',
          border: `1px solid ${isCompleted ? 'rgba(52,211,153,0.3)' : 'rgba(245,158,11,0.3)'}`,
        }}>
          {isCompleted ? '🔒 FINAL RESULTS' : '⏳ IN PROGRESS'}
        </span>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px,1fr))', gap: '1rem', marginBottom: '2rem' }}>
        {[
          { label: 'Lifters', value: entries.filter(e => !e.is_disqualified).length, icon: '👤' },
          { label: 'Disqualified', value: entries.filter(e => e.is_disqualified).length, icon: '⛔' },
          { label: 'Top Total', value: entries[0]?.total > 0 ? `${entries[0].total.toFixed(1)} kg` : '—', icon: '⚡' },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--color-surface)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '1.25rem', textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', marginBottom: '0.35rem' }}>{s.icon}</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-primary)' }}>{s.value}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.2rem' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Leaderboard */}
      <div style={{ background: 'var(--color-surface)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', overflow: 'hidden' }}>
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <span>🏆</span>
          <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Leaderboard</h2>
          <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Best of 3 attempts · Highest total wins</span>
        </div>

        {entries.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--color-text-muted)' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>📋</div>
            No participants registered yet.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                  {['Rank', 'Lifter', '🟥 Squat (best of 3)', '🟦 Bench Press (best of 3)', '⬛ Dead Lift (best of 3)', '⚡ Total', 'Status'].map(h => (
                    <th key={h} style={{ padding: '0.9rem 1rem', textAlign: 'left', fontSize: '0.72rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, idx) => {
                  const rank = entry.rank;
                  const isDQ = entry.is_disqualified;
                  const rankStyle = RANK_STYLES[rank];
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
                        ) : rankStyle ? (
                          <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: rankStyle.bg, color: rankStyle.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
                            {rankStyle.medal}
                          </div>
                        ) : (
                          <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(255,255,255,0.08)', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                            {rank || '—'}
                          </div>
                        )}
                      </td>

                      {/* Name */}
                      <td style={{ padding: '1rem', fontWeight: 700 }}>{entry.name}</td>

                      {/* Squat attempts */}
                      <td style={{ padding: '1rem' }}>
                        <AttemptDots attempts={entry.squat} />
                        {entry.squat_best > 0 && <div style={{ fontSize: '0.78rem', color: '#a78bfa', fontWeight: 700, marginTop: '0.2rem' }}>Best: {entry.squat_best} kg</div>}
                      </td>

                      {/* Bench attempts */}
                      <td style={{ padding: '1rem' }}>
                        <AttemptDots attempts={entry.bench_press} />
                        {entry.bench_best > 0 && <div style={{ fontSize: '0.78rem', color: '#a78bfa', fontWeight: 700, marginTop: '0.2rem' }}>Best: {entry.bench_best} kg</div>}
                      </td>

                      {/* Deadlift attempts */}
                      <td style={{ padding: '1rem' }}>
                        <AttemptDots attempts={entry.dead_lift} />
                        {entry.dead_lift_best > 0 && <div style={{ fontSize: '0.78rem', color: '#a78bfa', fontWeight: 700, marginTop: '0.2rem' }}>Best: {entry.dead_lift_best} kg</div>}
                      </td>

                      {/* Total */}
                      <td style={{ padding: '1rem' }}>
                        {entry.total > 0 ? (
                          <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '1.05rem', color: rank === 1 ? '#f59e0b' : rank === 2 ? '#94a3b8' : rank === 3 ? '#cd7f32' : '#a78bfa' }}>
                            {entry.total.toFixed(1)} kg
                          </span>
                        ) : <span style={{ color: 'var(--color-text-muted)' }}>—</span>}
                      </td>

                      {/* Status */}
                      <td style={{ padding: '1rem' }}>
                        {isDQ ? (
                          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#ef4444', background: 'rgba(239,68,68,0.1)', padding: '3px 8px', borderRadius: '6px' }}>Disqualified</span>
                        ) : rank === 1 ? (
                          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#f59e0b', background: 'rgba(245,158,11,0.1)', padding: '3px 8px', borderRadius: '6px' }}>🥇 Leader</span>
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
