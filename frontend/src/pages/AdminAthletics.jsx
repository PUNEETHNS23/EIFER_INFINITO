import { useState, useEffect } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import api from '../api';
import { getSportCategories } from '../sports/sportsConfig';

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

function AdminAthletics() {
  const { user, authLoading } = useAuth();
  const [teams, setTeams] = useState([]);
  const [draft, setDraft] = useState({});
  const [categoryFilter, setCategoryFilter] = useState('4 X 100 meter run');

  const fetchTeams = async () => {
    try {
      const res = await api.get('/teams/sport/athletics');
      setTeams(res.data);
    } catch (err) {
      console.error('Failed to fetch athletics teams', err);
    }
  };

  useEffect(() => {
    if (user) fetchTeams();
  }, [user]);

  if (authLoading) return null;
  if (!user) return <Navigate to="/login" />;

  const categories = getSportCategories('athletics');

  const getValues = (t) => ({
    time_sec: 0, is_injured: false, is_disqualified: false,
    ...(t.results || {}),
    ...(draft[t.id] || {}),
  });

  const patchDraft = (teamId, field, value) => {
    setDraft(prev => ({ ...prev, [teamId]: { ...(prev[teamId] || {}), [field]: value } }));
  };

  const saveResults = async (t) => {
    const vals = getValues(t);
    try {
      await api.put(`/teams/${t.id}/results`, {
        time_sec: parseFloat(vals.time_sec) || 0,
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

  const filteredTeams = teams.filter(t => (t.category || categories[0]) === categoryFilter);

  return (
    <div className="container" style={{ paddingTop: '2rem', paddingBottom: '4rem' }}>
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link to="/admin" className="btn-outline btn-sm">← Back</Link>
          <div>
            <h1 className="page-title" style={{ margin: 0 }}>🏃 Athletics Entry</h1>
            <p style={{ color: 'var(--color-text-muted)', marginTop: '0.25rem', fontSize: '0.9rem' }}>
              Enter finish times for each participant. Lower time ranks higher.
            </p>
          </div>
        </div>

        <div className="input-group" style={{ margin: 0, maxWidth: '280px' }}>
          <select 
            className="input-field" 
            value={categoryFilter} 
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      <div className="card">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <th style={thStyle}>Participant / Team</th>
                <th style={thStyle}>Squad Size</th>
                <th style={thStyle}>⏱️ Time (Seconds)</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Injured</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Disqualified</th>
                <th style={thStyle}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredTeams.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-muted)' }}>
                    No teams registered for "{categoryFilter}" yet.
                  </td>
                </tr>
              ) : (
                filteredTeams.map(t => {
                  const v = getValues(t);
                  const isDirty = !!draft[t.id];
                  return (
                    <tr 
                      key={t.id} 
                      style={{ 
                        borderBottom: '1px solid rgba(255,255,255,0.06)',
                        opacity: (v.is_injured || v.is_disqualified) ? 0.65 : 1
                      }}
                    >
                      <td style={tdStyle}>
                        <strong>{t.name}</strong>
                        {isDirty && <span style={{ marginLeft: '0.4rem', color: 'var(--color-primary)' }}>●</span>}
                      </td>
                      <td style={{ ...tdStyle, color: 'var(--color-text-muted)' }}>{t.squad?.length || 0} members</td>
                      <td style={tdStyle}>
                        <input
                          type="number"
                          step="0.001"
                          min="0"
                          value={v.time_sec}
                          onChange={e => patchDraft(t.id, 'time_sec', e.target.value)}
                          style={{
                            width: '100px', padding: '0.4rem 0.5rem',
                            background: 'rgba(255,255,255,0.05)',
                            border: '1px solid rgba(255,255,255,0.15)',
                            borderRadius: '6px', color: 'inherit'
                          }}
                        />
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={v.is_injured}
                          onChange={e => patchDraft(t.id, 'is_injured', e.target.checked)}
                          style={{ width: '16px', height: '16px' }}
                        />
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={v.is_disqualified}
                          onChange={e => patchDraft(t.id, 'is_disqualified', e.target.checked)}
                          style={{ width: '16px', height: '16px' }}
                        />
                      </td>
                      <td style={tdStyle}>
                        <button
                          className="btn-outline btn-sm"
                          disabled={!isDirty}
                          onClick={() => saveResults(t)}
                        >
                          {isDirty ? 'Save' : '✓ Saved'}
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default AdminAthletics;
