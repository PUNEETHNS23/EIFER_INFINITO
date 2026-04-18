import React, { useState, useEffect, useCallback } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import api from '../api';

/* ── Constants ────────────────────────────────────────────────────── */
const LIFTS = [
  { key: 'squat',       label: 'Squat',       icon: '🟥', color: '#ef4444' },
  { key: 'bench_press', label: 'Bench Press',  icon: '🟦', color: '#3b82f6' },
  { key: 'dead_lift',   label: 'Dead Lift',    icon: '⬛', color: '#6b7280' },
];

const RANK_MEDAL = { 1: '🥇', 2: '🥈', 3: '🥉' };

const emptyEntry = () => ({
  name: '',
  squat:       [0, 0, 0],
  bench_press: [0, 0, 0],
  dead_lift:   [0, 0, 0],
  is_disqualified: false,
});

/* ── Attempt input with embedded best highlight ───────────────────── */
function AttemptInput({ lift, attempts, onChange, disabled }) {
  const values = [...(attempts || [0, 0, 0])].slice(0, 3);
  const best = Math.max(...values.filter(v => v > 0), 0);

  return (
    <div>
      <div style={{ fontSize: '0.78rem', fontWeight: 600, color: lift.color, marginBottom: '0.4rem' }}>
        {lift.icon} {lift.label}
      </div>
      <div style={{ display: 'flex', gap: '0.4rem' }}>
        {values.map((v, i) => (
          <div key={i} style={{ flex: 1 }}>
            <div style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', marginBottom: '0.15rem', textAlign: 'center' }}>
              Attempt {i + 1}
            </div>
            <input
              type="number"
              min="0"
              step="0.5"
              disabled={disabled}
              value={v || ''}
              placeholder="0"
              onChange={e => {
                const next = [...values];
                next[i] = parseFloat(e.target.value) || 0;
                onChange(next);
              }}
              style={{
                width: '100%',
                padding: '0.5rem 0.4rem',
                borderRadius: '8px',
                border: `1px solid ${v === best && v > 0 ? lift.color + '80' : 'rgba(255,255,255,0.12)'}`,
                background: v === best && v > 0 ? `${lift.color}18` : 'rgba(255,255,255,0.04)',
                color: 'inherit',
                fontFamily: 'monospace',
                fontSize: '0.88rem',
                textAlign: 'center',
                cursor: disabled ? 'not-allowed' : 'text',
              }}
            />
          </div>
        ))}
      </div>
      {best > 0 && (
        <div style={{ textAlign: 'right', fontSize: '0.72rem', color: '#a78bfa', marginTop: '0.25rem', fontWeight: 700 }}>
          Best: {best} kg
        </div>
      )}
    </div>
  );
}

/* ── Main Component ──────────────────────────────────────────────── */
export default function AdminWeightliftingEventManager() {
  const { user, authLoading } = useAuth();

  const [events, setEvents] = useState([]);
  const [teams, setTeams] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [eventDetail, setEventDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [entryForm, setEntryForm] = useState(null);
  const [editingEntryId, setEditingEntryId] = useState(null);

  /* ── Data fetching ───────────────────────────────────────────── */
  const fetchEvents = useCallback(async () => {
    try {
      const res = await api.get('/weightlifting/events');
      setEvents(res.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  const fetchTeams = useCallback(async () => {
    try {
      const res = await api.get('/teams/sport/weight-lifting');
      setTeams(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const fetchEventDetail = useCallback(async (id) => {
    if (!id) return;
    try {
      const res = await api.get(`/weightlifting/events/${id}`);
      setEventDetail(res.data);
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => {
    if (user) {
      fetchEvents();
      fetchTeams();
    }
  }, [user, fetchEvents, fetchTeams]);

  const applySelectedTeam = (teamId) => {
    if (!teamId) {
      setEntryForm((prev) => ({ ...(prev || emptyEntry()), team_id: '', name: '' }));
      return;
    }
    const selectedTeam = teams.find((team) => String(team.id) === String(teamId));
    setEntryForm((prev) => ({
      ...(prev || emptyEntry()),
      team_id: teamId,
      name: selectedTeam?.name || '',
    }));
  };

  const selectEvent = (id) => {
    setSelectedEventId(id);
    setEntryForm(null);
    setEditingEntryId(null);
    fetchEventDetail(id);
  };

  /* ── Create / Delete event ──────────────────────────────────── */
  const handleCreateEvent = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/weightlifting/events', { label: newLabel.trim() || undefined });
      await fetchEvents();
      selectEvent(res.data.id);
      setNewLabel('');
    } catch (err) { alert(err.response?.data?.detail || 'Failed to create event'); }
  };

  const handleDeleteEvent = async (id) => {
    if (!window.confirm('Delete this event and all entries?')) return;
    try {
      await api.delete(`/weightlifting/events/${id}`);
      await fetchEvents();
      if (selectedEventId === id) { setSelectedEventId(null); setEventDetail(null); }
    } catch (err) { alert(err.response?.data?.detail || 'Failed to delete'); }
  };

  /* ── Entry CRUD ─────────────────────────────────────────────── */
  const openAdd = () => { setEditingEntryId(null); setEntryForm({ ...emptyEntry(), team_id: '' }); };
  const openEdit = (entry) => {
    setEditingEntryId(entry.id);
    const matchedTeam = teams.find((team) => team.name === entry.name);
    setEntryForm({
      team_id: matchedTeam?.id || '',
      name: entry.name,
      squat:       [...(entry.squat || [0, 0, 0])],
      bench_press: [...(entry.bench_press || [0, 0, 0])],
      dead_lift:   [...(entry.dead_lift || [0, 0, 0])],
      is_disqualified: entry.is_disqualified,
    });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!entryForm.name.trim()) { alert('Name is required.'); return; }
    setSaving(true);
    const body = {
      name: entryForm.name,
      squat:       entryForm.squat.map(v => parseFloat(v) || 0),
      bench_press: entryForm.bench_press.map(v => parseFloat(v) || 0),
      dead_lift:   entryForm.dead_lift.map(v => parseFloat(v) || 0),
      is_disqualified: entryForm.is_disqualified,
    };
    try {
      if (editingEntryId) {
        await api.put(`/weightlifting/events/${selectedEventId}/entries/${editingEntryId}`, body);
      } else {
        await api.post(`/weightlifting/events/${selectedEventId}/entries`, body);
      }
      await fetchEventDetail(selectedEventId);
      setEntryForm(null);
      setEditingEntryId(null);
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to save');
    } finally { setSaving(false); }
  };

  const handleDeleteEntry = async (entryId) => {
    if (!window.confirm('Remove this lifter?')) return;
    try {
      await api.delete(`/weightlifting/events/${selectedEventId}/entries/${entryId}`);
      await fetchEventDetail(selectedEventId);
    } catch (err) { alert(err.response?.data?.detail || 'Failed to delete'); }
  };

  const handleFinalize = async () => {
    if (!window.confirm('Finalize? Rankings will be locked permanently.')) return;
    try {
      await api.post(`/weightlifting/events/${selectedEventId}/finalize`);
      await fetchEvents();
      await fetchEventDetail(selectedEventId);
    } catch (err) { alert(err.response?.data?.detail || 'Failed to finalize'); }
  };

  const handlePodiumRematch = async (rank, groupEntries) => {
    if (!window.confirm(`Start rematch score entry for tied rank #${rank}?`)) return;

    const results = [];
    for (const entry of groupEntries) {
      const input = window.prompt(
        `Enter final rematch total (kg) for \"${entry.name}\" (rank #${rank} tie):`,
        ''
      );
      if (input === null) {
        return;
      }
      const value = parseFloat(input);
      if (!Number.isFinite(value) || value <= 0) {
        alert('Please enter a valid positive rematch total.');
        return;
      }
      results.push({ entry_id: entry.id, final_score: value });
    }

    try {
      await api.post(`/weightlifting/events/${selectedEventId}/rematch`, { rank, results });
      await fetchEventDetail(selectedEventId);
      alert('Rematch scores saved. Leaderboard updated.');
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to save rematch scores');
    }
  };

  /* ── Draft total helper ─────────────────────────────────────── */
  const draftTotal = entryForm ? ['squat', 'bench_press', 'dead_lift'].reduce((sum, k) => {
    const best = Math.max(...(entryForm[k] || [0, 0, 0]).map(v => parseFloat(v) || 0).filter(v => v > 0), 0);
    return sum + best;
  }, 0) : 0;

  /* ── Auth ───────────────────────────────────────────────────── */
  if (authLoading) return null;
  if (!user) return <Navigate to="/login" />;

  const isFinalized = eventDetail?.status === 'completed';
  const entries = eventDetail?.entries || [];
  const tiedPodiumGroups = [1, 2, 3]
    .map((rank) => ({
      rank,
      entries: entries.filter((entry) => !entry.is_disqualified && entry.rank === rank),
    }))
    .filter((group) => group.entries.length > 1);

  return (
    <div className="container" style={{ paddingTop: '2rem', paddingBottom: '5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
        <Link to="/admin" className="btn-outline btn-sm">← Admin</Link>
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>🏋️ Weight Lifting Leaderboard Manager</h1>
          <p style={{ color: 'var(--color-text-muted)', margin: '0.25rem 0 0', fontSize: '0.88rem' }}>
            3 attempts per lift · Best counts · Squat + Bench + Deadlift = Total
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '1.5rem', alignItems: 'start' }}>

        {/* ── LEFT: Events ──────────────────────────────────────────── */}
        <div>
          {/* Create */}
          <div className="card" style={{ marginBottom: '1rem' }}>
            <h3 style={{ margin: '0 0 1rem', fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-primary)' }}>+ New Event</h3>
            <form onSubmit={handleCreateEvent}>
              <div className="input-group">
                <label className="input-label">Label / Category</label>
                <input type="text" className="input-field" placeholder="e.g. Men's Open, U60kg Final…" value={newLabel} onChange={e => setNewLabel(e.target.value)} />
              </div>
              <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '0.5rem' }}>Create Event</button>
            </form>
          </div>

          {/* Event List */}
          <div className="card">
            <h3 style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', fontWeight: 700 }}>Events ({events.length})</h3>
            {loading ? <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>Loading…</p> : events.length === 0 ? (
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>No events yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {events.map(ev => {
                  const isSel = selectedEventId === ev.id;
                  const isComp = ev.status === 'completed';
                  return (
                    <div key={ev.id} onClick={() => selectEvent(ev.id)} style={{
                      padding: '0.75rem 1rem', borderRadius: '10px',
                      border: `1px solid ${isSel ? 'var(--color-primary)' : 'rgba(255,255,255,0.08)'}`,
                      background: isSel ? 'rgba(99,102,241,0.1)' : 'rgba(255,255,255,0.02)',
                      cursor: 'pointer',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>🏋️ {ev.label || 'Powerlifting Event'}</div>
                        <button type="button" onClick={e => { e.stopPropagation(); handleDeleteEvent(ev.id); }}
                          style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.9rem', padding: 0 }}>🗑️</button>
                      </div>
                      <div style={{ marginTop: '0.4rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <span style={{ padding: '0.25rem 0.7rem', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 700,
                          background: isComp ? 'rgba(52,211,153,0.12)' : 'rgba(245,158,11,0.12)',
                          color: isComp ? '#34d399' : '#f59e0b',
                          border: `1px solid ${isComp ? 'rgba(52,211,153,0.3)' : 'rgba(245,158,11,0.3)'}` }}>
                          {isComp ? '🔒 Final' : '⏳ Live'}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                          {(ev.entries || []).length} lifters
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT: Event Detail ────────────────────────────────────── */}
        <div>
          {!selectedEventId ? (
            <div style={{ background: 'var(--color-surface)', border: '1px dashed rgba(255,255,255,0.15)', borderRadius: '16px', padding: '4rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📋</div>
              Select an event from the left to manage it.
            </div>
          ) : !eventDetail ? (
            <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--color-text-muted)' }}>Loading event…</div>
          ) : (
            <>
              {/* Event Header */}
              <div style={{
                background: 'linear-gradient(135deg, rgba(167,139,250,0.12), rgba(245,158,11,0.08))',
                border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', padding: '1.5rem', marginBottom: '1.5rem',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                  <div>
                    <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.3rem', fontWeight: 800 }}>
                      🏋️ {eventDetail.label || 'Powerlifting Event'}
                    </h2>
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                      <span style={{ padding: '0.3rem 0.9rem', borderRadius: '999px', fontSize: '0.78rem', fontWeight: 700,
                        background: isFinalized ? 'rgba(52,211,153,0.12)' : 'rgba(245,158,11,0.12)',
                        color: isFinalized ? '#34d399' : '#f59e0b',
                        border: `1px solid ${isFinalized ? 'rgba(52,211,153,0.3)' : 'rgba(245,158,11,0.3)'}` }}>
                        {isFinalized ? '🔒 FINAL' : '⏳ UPCOMING'}
                      </span>
                      <span style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>{entries.length} lifter{entries.length !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    {!isFinalized && (
                      <>
                        <button type="button" className="btn-outline btn-sm"
                          style={{ color: 'var(--color-primary)', borderColor: 'var(--color-primary)' }} onClick={openAdd}>
                          + Add Lifter
                        </button>
                        <button type="button" className="btn-primary"
                          style={{ background: '#10b981', borderColor: '#10b981' }}
                          onClick={handleFinalize} disabled={entries.length === 0}>
                          🔒 Finalize
                        </button>
                      </>
                    )}
                    {isFinalized && (
                      <Link to={`/weightlifting/${eventDetail.id}`} className="btn-outline btn-sm">View Public →</Link>
                    )}
                  </div>
                </div>
                {isFinalized && (
                  <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)', borderRadius: '8px', fontSize: '0.84rem', color: '#34d399' }}>
                    🔒 Finalized at: {eventDetail.finalized_at ? new Date(eventDetail.finalized_at).toLocaleString() : '—'}
                  </div>
                )}
              </div>

              {!isFinalized && tiedPodiumGroups.length > 0 && (
                <div className="card" style={{ marginBottom: '1.5rem', borderColor: 'rgba(245,158,11,0.35)' }}>
                  <h3 style={{ margin: '0 0 0.65rem', fontSize: '0.95rem', fontWeight: 700, color: '#f59e0b' }}>
                    🥇🥈🥉 Podium Tie Rematch
                  </h3>
                  <p style={{ margin: '0 0 1rem', color: 'var(--color-text-muted)', fontSize: '0.83rem' }}>
                    Rematch is available only for tied rank 1, 2, or 3. Enter final rematch totals to break ties.
                  </p>
                  <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                    {tiedPodiumGroups.map((group) => (
                      <button
                        key={group.rank}
                        type="button"
                        className="btn-outline btn-sm"
                        style={{ borderColor: '#f59e0b', color: '#f59e0b' }}
                        onClick={() => handlePodiumRematch(group.rank, group.entries)}
                      >
                        Resolve Rank #{group.rank} Tie ({group.entries.length})
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Add / Edit Entry Form */}
              {entryForm && (
                <div className="card" style={{ marginBottom: '1.5rem', borderColor: 'rgba(167,139,250,0.3)' }}>
                  <h3 style={{ margin: '0 0 1.5rem', fontSize: '1rem', fontWeight: 700, color: '#a78bfa' }}>
                    {editingEntryId ? '✏️ Edit Lifter' : '+ Add New Lifter'}
                  </h3>

                  {/* Draft total preview */}
                  {draftTotal > 0 && (
                    <div style={{ padding: '0.75rem 1rem', background: 'rgba(167,139,250,0.08)', borderRadius: '10px', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>⚡ Projected Total</span>
                      <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '1.2rem', color: '#a78bfa' }}>{draftTotal.toFixed(1)} kg</span>
                    </div>
                  )}

                  <form onSubmit={handleSave}>
                    <div className="input-group" style={{ marginBottom: '1.5rem' }}>
                      <label className="input-label">Lifter Name</label>
                      <select
                        className="input-field"
                        value={entryForm.team_id || ''}
                        onChange={(e) => applySelectedTeam(e.target.value)}
                        required
                      >
                        <option value="">Select a registered weight-lifting team</option>
                        {teams.map((team) => (
                          <option key={team.id} value={team.id}>{team.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* 3 lifts × 3 attempts grid */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginBottom: '1.5rem' }}>
                      {LIFTS.map(lift => (
                        <AttemptInput
                          key={lift.key}
                          lift={lift}
                          attempts={entryForm[lift.key]}
                          disabled={isFinalized}
                          onChange={vals => setEntryForm(f => ({ ...f, [lift.key]: vals }))}
                        />
                      ))}
                    </div>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.88rem', cursor: 'pointer', marginBottom: '1.25rem', color: entryForm.is_disqualified ? '#ef4444' : 'var(--color-text-muted)' }}>
                      <input type="checkbox" checked={entryForm.is_disqualified} onChange={e => setEntryForm(f => ({ ...f, is_disqualified: e.target.checked }))} />
                      ⛔ Mark as Disqualified
                    </label>

                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                      <button type="button" className="btn-outline btn-sm" style={{ flex: 1 }} onClick={() => { setEntryForm(null); setEditingEntryId(null); }}>Cancel</button>
                      <button type="submit" className="btn-primary" style={{ flex: 2 }} disabled={saving}>
                        {saving ? 'Saving…' : editingEntryId ? 'Update Lifter' : 'Add Lifter'}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Leaderboard Table */}
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <span>🏆</span>
                  <h3 style={{ margin: 0, fontWeight: 700, fontSize: '0.95rem' }}>Live Leaderboard</h3>
                  <span style={{ marginLeft: 'auto', fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>Highest total first ↓</span>
                </div>

                {entries.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-muted)' }}>
                    <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>📋</div>
                    No lifters yet.
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                      <thead>
                        <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                          {['Rank', 'Lifter', '🟥 Squat', '🟦 Bench', '⬛ Deadlift', '⚡ Total', !isFinalized && 'Actions'].filter(Boolean).map(h => (
                            <th key={h} style={{ padding: '0.75rem 0.8rem', textAlign: 'left', fontSize: '0.7rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {entries.map((entry, idx) => {
                          const rank = entry.rank;
                          const isDQ = entry.is_disqualified;
                          const best = (k) => Math.max(...(entry[k] || [0, 0, 0]).filter(v => v > 0), 0);
                          return (
                            <tr key={entry.id || idx} style={{
                              borderTop: '1px solid rgba(255,255,255,0.05)',
                              background: isDQ ? 'rgba(239,68,68,0.03)' : rank === 1 ? 'rgba(245,158,11,0.04)' : 'transparent',
                              opacity: isDQ ? 0.65 : 1,
                            }}>
                              {/* Rank */}
                              <td style={{ padding: '0.8rem' }}>
                                {isDQ ? (
                                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#ef4444', background: 'rgba(239,68,68,0.12)', padding: '2px 6px', borderRadius: '5px' }}>DQ</span>
                                ) : (
                                  <div style={{ width: '30px', height: '30px', borderRadius: '8px',
                                    background: rank === 1 ? 'linear-gradient(135deg,#f59e0b,#d97706)' : rank === 2 ? 'linear-gradient(135deg,#94a3b8,#64748b)' : rank === 3 ? 'linear-gradient(135deg,#cd7f32,#a0522d)' : 'rgba(255,255,255,0.08)',
                                    color: rank <= 3 ? (rank === 1 ? '#000' : '#fff') : 'var(--color-text-muted)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.82rem' }}>
                                    {RANK_MEDAL[rank] || rank || '—'}
                                  </div>
                                )}
                              </td>
                              {/* Name */}
                              <td style={{ padding: '0.8rem', fontWeight: 700 }}>{entry.name}</td>
                              {/* Lifts */}
                              {LIFTS.map(lift => (
                                <td key={lift.key} style={{ padding: '0.8rem' }}>
                                  <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
                                    {(entry[lift.key] || [0,0,0]).map((v, i) => (
                                      <span key={i} style={{ display: 'inline-block', marginRight: '0.3rem',
                                        fontFamily: 'monospace',
                                        color: v > 0 && v === best(lift.key) ? '#a78bfa' : v > 0 ? 'var(--color-text)' : 'var(--color-text-muted)',
                                        fontWeight: v > 0 && v === best(lift.key) ? 700 : 400 }}>
                                        {v > 0 ? `${v}` : '—'}
                                      </span>
                                    ))}
                                  </div>
                                  <div style={{ fontSize: '0.72rem', color: '#a78bfa', fontWeight: 600 }}>
                                    {best(lift.key) > 0 ? `Best: ${best(lift.key)} kg` : '—'}
                                  </div>
                                </td>
                              ))}
                              {/* Total */}
                              <td style={{ padding: '0.8rem' }}>
                                <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '1rem', color: rank === 1 ? '#f59e0b' : rank === 2 ? '#94a3b8' : rank === 3 ? '#cd7f32' : '#a78bfa' }}>
                                  {entry.total > 0 ? `${entry.total.toFixed(1)} kg` : '—'}
                                </span>
                                {Number(entry.rematch_score || 0) > 0 && (
                                  <div style={{ fontSize: '0.72rem', color: '#10b981', marginTop: '0.15rem', fontWeight: 700 }}>
                                    Rematch: {Number(entry.rematch_score).toFixed(1)} kg
                                  </div>
                                )}
                              </td>
                              {/* Actions */}
                              {!isFinalized && (
                                <td style={{ padding: '0.8rem' }}>
                                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                                    <button className="btn-outline btn-sm" style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }} onClick={() => openEdit(entry)}>✏️</button>
                                    <button className="btn-outline btn-sm" style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', color: '#ef4444', borderColor: '#ef4444' }} onClick={() => handleDeleteEntry(entry.id)}>🗑️</button>
                                  </div>
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
