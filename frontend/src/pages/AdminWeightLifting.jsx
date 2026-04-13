import React, { useState, useEffect } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import api from '../api';

const thStyle = {
  padding: '0.75rem 1rem',
  textAlign: 'left',
  fontWeight: 600,
  fontSize: '0.8rem',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: 'var(--color-text-muted)',
};
const tdStyle = { padding: '0.65rem 1rem', verticalAlign: 'middle' };

function AdminWeightLifting() {
  const { user, authLoading } = useAuth();
  const [teams, setTeams] = useState([]);
  const [draft, setDraft] = useState({});

  const fetchTeams = async () => {
    try {
      const res = await api.get('/teams/sport/weight-lifting');
      setTeams(res.data);
    } catch (err) {
      console.error('Failed to fetch weight-lifting teams', err);
    }
  };

  useEffect(() => {
    if (user) fetchTeams();
  }, [user]);

  if (authLoading) return null;
  if (!user) return <Navigate to="/login" />;

  const getValues = (t) => ({
    squat: 0, bench: 0, deadlift: 0, is_injured: false, is_disqualified: false,
    ...(t.results || {}),
    ...(draft[t.id] || {}),
  });

  const patchDraft = (teamId, field, value) => {
    setDraft(prev => ({ ...prev, [teamId]: { ...(prev[teamId] || {}), [field]: value } }));
  };

  const saveResults = async (t) => {
    const vals = getValues(t);
    const sq = parseFloat(vals.squat) || 0;
    const bn = parseFloat(vals.bench) || 0;
    const dl = parseFloat(vals.deadlift) || 0;
    try {
      await api.put(`/teams/${t.id}/results`, {
        squat: sq, bench: bn, deadlift: dl,
        total: sq + bn + dl,
        is_injured: vals.is_injured,
        is_disqualified: vals.is_disqualified,
      });
      setDraft(prev => { const next = { ...prev }; delete next[t.id]; return next; });
      fetchTeams();
    } catch (err) {
      alert('Failed to save results for ' + t.name);
      console.error(err);
    }
  };

  return (
    <div className="container" style={{ paddingTop: '2rem', paddingBottom: '4rem' }}>
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
        <Link to="/admin" className="btn-outline btn-sm">← Back to Dashboard</Link>
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>🏋️ Powerlifting Entry</h1>
          <p style={{ color: 'var(--color-text-muted)', marginTop: '0.25rem', fontSize: '0.9rem' }}>
            Enter Squat, Bench Press, and Deadlift for each participant. Total is auto-calculated.
          </p>
        </div>
      </div>

      {teams.length === 0 ? (
        <div className="card">
          <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '3rem' }}>
            No participants registered yet. Add them from the{' '}
            <Link to="/admin" style={{ color: 'var(--color-primary)' }}>Teams tab</Link>.
          </p>
        </div>
      ) : (
        <div className="card">
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                  <th style={thStyle}>Participant</th>
                  <th style={thStyle}>Category</th>
                  <th style={thStyle}>🟥 Squat (kg)</th>
                  <th style={thStyle}>🟦 Bench (kg)</th>
                  <th style={thStyle}>⬛ Deadlift (kg)</th>
                  <th style={{ ...thStyle, background: 'rgba(99,102,241,0.15)', color: '#a78bfa' }}>⚡ Total (kg)</th>
                  <th style={{ ...thStyle, textAlign: 'center' }}>Injured</th>
                  <th style={{ ...thStyle, textAlign: 'center' }}>Disqualified</th>
                  <th style={thStyle}>Action</th>
                </tr>
              </thead>
              <tbody>
                {teams.map(t => {
                  const v = getValues(t);
                  const sq = parseFloat(v.squat) || 0;
                  const bn = parseFloat(v.bench) || 0;
                  const dl = parseFloat(v.deadlift) || 0;
                  const total = sq + bn + dl;
                  const isDirty = !!draft[t.id];
                  const locked = v.is_injured || v.is_disqualified;
                  return (
                    <tr
                      key={t.id}
                      style={{
                        borderBottom: '1px solid rgba(255,255,255,0.06)',
                        opacity: (v.is_injured || v.is_disqualified) ? 0.65 : 1,
                        transition: 'opacity 0.2s',
                      }}
                    >
                      <td style={tdStyle}>
                        <strong>{t.name}</strong>
                        {isDirty && (
                          <span style={{ marginLeft: '0.4rem', fontSize: '0.7rem', color: 'var(--color-primary)' }}>●</span>
                        )}
                      </td>
                      <td style={{ ...tdStyle, color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>{t.category}</td>
                      {['squat', 'bench', 'deadlift'].map(field => (
                        <td key={field} style={tdStyle}>
                          <input
                            type="number"
                            min="0"
                            step="0.5"
                            disabled={locked}
                            value={v[field]}
                            onChange={e => patchDraft(t.id, field, parseFloat(e.target.value) || 0)}
                            style={{
                              width: '85px',
                              padding: '0.4rem 0.5rem',
                              background: 'rgba(255,255,255,0.05)',
                              border: `1px solid ${isDirty ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.15)'}`,
                              borderRadius: '6px',
                              color: 'inherit',
                              cursor: locked ? 'not-allowed' : 'text',
                              transition: 'border-color 0.2s',
                            }}
                          />
                        </td>
                      ))}
                      <td style={{ ...tdStyle, fontWeight: 700, color: '#a78bfa', background: 'rgba(99,102,241,0.08)' }}>
                        {total.toFixed(1)}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={v.is_injured}
                          onChange={e => patchDraft(t.id, 'is_injured', e.target.checked)}
                          style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#f59e0b' }}
                        />
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={v.is_disqualified}
                          onChange={e => patchDraft(t.id, 'is_disqualified', e.target.checked)}
                          style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#ff4444' }}
                        />
                      </td>
                      <td style={tdStyle}>
                        <button
                          className="btn-outline btn-sm"
                          disabled={!isDirty}
                          onClick={() => saveResults(t)}
                          style={{
                            borderColor: isDirty ? 'var(--color-primary)' : 'rgba(255,255,255,0.2)',
                            color: isDirty ? 'var(--color-primary)' : 'var(--color-text-muted)',
                            cursor: isDirty ? 'pointer' : 'default',
                            transition: 'all 0.2s',
                          }}
                        >
                          {isDirty ? 'Save' : '✓ Saved'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminWeightLifting;
