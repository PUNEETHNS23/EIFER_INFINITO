import React, { useState, useEffect, useCallback } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import api from '../api';

/* ─── Constants ─────────────────────────────────────────────────── */
const EVENT_TYPES = [
  { value: 'relay_4x100', label: '4 × 100m Relay', icon: '🏃‍♂️🏃‍♀️', playerCount: 4, isTeam: true },
  { value: 'boys_100m',   label: 'Boys 100m',       icon: '🏃‍♂️',     playerCount: 0, isTeam: false },
  { value: 'girls_100m',  label: 'Girls 100m',      icon: '🏃‍♀️',     playerCount: 0, isTeam: false },
];

const STATUS_COLORS = {
  upcoming:  { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: 'rgba(245,158,11,0.3)' },
  completed: { bg: 'rgba(52,211,153,0.12)', color: '#34d399', border: 'rgba(52,211,153,0.3)' },
};

const RANK_MEDAL = { 1: '🥇', 2: '🥈', 3: '🥉' };

/* ─── Helpers ────────────────────────────────────────────────────── */
const emptyEntry = (eventType) => ({
  team_name: '',
  players: eventType === 'relay_4x100' ? ['', '', '', ''] : [],
  time_sec: '',
  is_disqualified: false,
});

/* ─── Small reusable components ──────────────────────────────────── */
function StatusBadge({ status }) {
  const s = STATUS_COLORS[status] || STATUS_COLORS.upcoming;
  return (
    <span style={{
      padding: '0.3rem 0.9rem', borderRadius: '999px',
      fontSize: '0.78rem', fontWeight: 700,
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
      letterSpacing: '0.05em',
    }}>
      {status === 'completed' ? '🔒 FINAL' : '⏳ UPCOMING'}
    </span>
  );
}

/* ─── Main Component ─────────────────────────────────────────────── */
export default function AdminAthleticsEventManager() {
  const { user, authLoading } = useAuth();

  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [eventDetail, setEventDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Create event form
  const [newEventType, setNewEventType] = useState('relay_4x100');
  const [newEventLabel, setNewEventLabel] = useState('');

  // Add / edit entry form
  const [entryForm, setEntryForm] = useState(null); // null = hidden, object = shown
  const [editingEntryId, setEditingEntryId] = useState(null);

  /* ── Data fetching ────────────────────────────────────────────── */
  const fetchEvents = useCallback(async () => {
    try {
      const res = await api.get('/athletics/events');
      setEvents(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchEventDetail = useCallback(async (id) => {
    if (!id) return;
    try {
      const res = await api.get(`/athletics/events/${id}`);
      setEventDetail(res.data);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => { if (user) fetchEvents(); }, [user, fetchEvents]);

  const selectEvent = (id) => {
    setSelectedEventId(id);
    setEntryForm(null);
    setEditingEntryId(null);
    fetchEventDetail(id);
  };

  /* ── Create event ─────────────────────────────────────────────── */
  const handleCreateEvent = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/athletics/events', {
        event_type: newEventType,
        label: newEventLabel.trim() || undefined,
      });
      await fetchEvents();
      selectEvent(res.data.id);
      setNewEventLabel('');
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to create event');
    }
  };

  const handleDeleteEvent = async (id) => {
    if (!window.confirm('Delete this entire event and all its entries?')) return;
    try {
      await api.delete(`/athletics/events/${id}`);
      await fetchEvents();
      if (selectedEventId === id) { setSelectedEventId(null); setEventDetail(null); }
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to delete event');
    }
  };

  /* ── Entry CRUD ───────────────────────────────────────────────── */
  const openAddEntry = () => {
    if (!eventDetail) return;
    setEditingEntryId(null);
    setEntryForm(emptyEntry(eventDetail.event_type));
  };

  const openEditEntry = (entry) => {
    setEditingEntryId(entry.id);
    const et = eventDetail.event_type;
    setEntryForm({
      team_name: entry.team_name,
      players: et === 'relay_4x100'
        ? [...(entry.players || []), '', '', '', ''].slice(0, 4)
        : [],
      time_sec: entry.time_sec,
      is_disqualified: entry.is_disqualified,
    });
  };

  const handleSaveEntry = async (e) => {
    e.preventDefault();
    if (!entryForm.team_name.trim()) { alert('Name is required.'); return; }
    const timeVal = parseFloat(entryForm.time_sec);
    if (!timeVal || timeVal <= 0) { alert('Please enter a valid time in seconds.'); return; }
    setSaving(true);
    const body = {
      team_name: entryForm.team_name,
      players: (entryForm.players || []).filter(p => p.trim()),
      time_sec: timeVal,
      is_disqualified: entryForm.is_disqualified,
    };
    try {
      if (editingEntryId) {
        await api.put(`/athletics/events/${selectedEventId}/entries/${editingEntryId}`, body);
      } else {
        await api.post(`/athletics/events/${selectedEventId}/entries`, body);
      }
      await fetchEventDetail(selectedEventId);
      setEntryForm(null);
      setEditingEntryId(null);
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to save entry');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteEntry = async (entryId) => {
    if (!window.confirm('Remove this entry?')) return;
    try {
      await api.delete(`/athletics/events/${selectedEventId}/entries/${entryId}`);
      await fetchEventDetail(selectedEventId);
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to delete entry');
    }
  };

  /* ── Finalize ─────────────────────────────────────────────────── */
  const handleFinalize = async () => {
    if (!window.confirm('Finalize this event? Rankings will be locked and no further edits will be possible.')) return;
    try {
      await api.post(`/athletics/events/${selectedEventId}/finalize`);
      await fetchEvents();
      await fetchEventDetail(selectedEventId);
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to finalize event');
    }
  };

  /* ── Auth guards ──────────────────────────────────────────────── */
  if (authLoading) return null;
  if (!user) return <Navigate to="/login" />;

  const isFinalized = eventDetail?.status === 'completed';
  const isRelay = eventDetail?.event_type === 'relay_4x100';
  const entries = eventDetail?.entries || [];

  return (
    <div className="container" style={{ paddingTop: '2rem', paddingBottom: '5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
        <Link to="/admin" className="btn-outline btn-sm">← Admin</Link>
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>🏃 Athletics Leaderboard Manager</h1>
          <p style={{ color: 'var(--color-text-muted)', margin: '0.25rem 0 0', fontSize: '0.88rem' }}>
            Create events, add participants, and finalize results.
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '1.5rem', alignItems: 'start' }}>

        {/* ── LEFT: Event List + Create ────────────────────────────── */}
        <div>
          {/* Create Event Card */}
          <div className="card" style={{ marginBottom: '1rem' }}>
            <h3 style={{ margin: '0 0 1rem', fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-primary)' }}>
              + New Event
            </h3>
            <form onSubmit={handleCreateEvent}>
              <div className="input-group">
                <label className="input-label">Event Type</label>
                <select
                  className="input-field"
                  value={newEventType}
                  onChange={e => setNewEventType(e.target.value)}
                >
                  {EVENT_TYPES.map(et => (
                    <option key={et.value} value={et.value}>{et.icon} {et.label}</option>
                  ))}
                </select>
              </div>
              <div className="input-group">
                <label className="input-label">Label / Round (optional)</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. Heat 1, Final..."
                  value={newEventLabel}
                  onChange={e => setNewEventLabel(e.target.value)}
                />
              </div>
              <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '0.5rem' }}>
                Create Event
              </button>
            </form>
          </div>

          {/* Event List */}
          <div className="card">
            <h3 style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', fontWeight: 700 }}>Events ({events.length})</h3>
            {loading ? (
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>Loading...</p>
            ) : events.length === 0 ? (
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>No events yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {events.map(ev => {
                  const typeMeta = EVENT_TYPES.find(t => t.value === ev.event_type);
                  const isSelected = selectedEventId === ev.id;
                  return (
                    <div
                      key={ev.id}
                      onClick={() => selectEvent(ev.id)}
                      style={{
                        padding: '0.75rem 1rem',
                        borderRadius: '10px',
                        border: `1px solid ${isSelected ? 'var(--color-primary)' : 'rgba(255,255,255,0.08)'}`,
                        background: isSelected ? 'rgba(99,102,241,0.1)' : 'rgba(255,255,255,0.02)',
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                        <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>
                          {typeMeta?.icon} {ev.label || typeMeta?.label || ev.event_type}
                        </div>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleDeleteEvent(ev.id); }}
                          style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0', fontSize: '0.9rem' }}
                          title="Delete event"
                        >
                          🗑️
                        </button>
                      </div>
                      <div style={{ marginTop: '0.4rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <StatusBadge status={ev.status} />
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                          {(ev.entries || []).length} entries
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT: Event Detail / Leaderboard ───────────────────── */}
        <div>
          {!selectedEventId ? (
            <div style={{
              background: 'var(--color-surface)',
              border: '1px dashed rgba(255,255,255,0.15)',
              borderRadius: '16px',
              padding: '4rem',
              textAlign: 'center',
              color: 'var(--color-text-muted)',
            }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📋</div>
              Select an event from the left to manage it.
            </div>
          ) : !eventDetail ? (
            <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--color-text-muted)' }}>
              Loading event...
            </div>
          ) : (
            <>
              {/* Event Header */}
              <div style={{
                background: 'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(16,185,129,0.08))',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '16px',
                padding: '1.5rem',
                marginBottom: '1.5rem',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                  <div>
                    <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.3rem', fontWeight: 800 }}>
                      {EVENT_TYPES.find(t => t.value === eventDetail.event_type)?.icon}{' '}
                      {eventDetail.label || EVENT_TYPES.find(t => t.value === eventDetail.event_type)?.label}
                    </h2>
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      <StatusBadge status={eventDetail.status} />
                      <span style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>
                        {entries.length} participant{entries.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    {!isFinalized && (
                      <>
                        <button
                          type="button"
                          className="btn-outline btn-sm"
                          style={{ color: 'var(--color-primary)', borderColor: 'var(--color-primary)' }}
                          onClick={openAddEntry}
                        >
                          + Add Entry
                        </button>
                        <button
                          type="button"
                          className="btn-primary"
                          style={{ background: '#10b981', borderColor: '#10b981' }}
                          onClick={handleFinalize}
                          disabled={entries.length === 0}
                        >
                          🔒 Finalize Leaderboard
                        </button>
                      </>
                    )}
                    {isFinalized && (
                      <Link to={`/athletics/${eventDetail.id}`} className="btn-outline btn-sm">
                        View Public Page →
                      </Link>
                    )}
                  </div>
                </div>

                {isFinalized && (
                  <div style={{
                    marginTop: '1rem',
                    padding: '0.75rem 1rem',
                    background: 'rgba(52,211,153,0.08)',
                    border: '1px solid rgba(52,211,153,0.2)',
                    borderRadius: '8px',
                    fontSize: '0.84rem',
                    color: '#34d399',
                  }}>
                    🔒 This event has been finalized. Rankings are locked. Finalized at:{' '}
                    {eventDetail.finalized_at ? new Date(eventDetail.finalized_at).toLocaleString() : '—'}
                  </div>
                )}
              </div>

              {/* Add / Edit Entry Form */}
              {entryForm && (
                <div className="card" style={{ marginBottom: '1.5rem', borderColor: 'rgba(99,102,241,0.3)' }}>
                  <h3 style={{ margin: '0 0 1.25rem', fontSize: '1rem', fontWeight: 700, color: 'var(--color-primary)' }}>
                    {editingEntryId ? '✏️ Edit Entry' : '+ Add New Entry'}
                  </h3>
                  <form onSubmit={handleSaveEntry}>
                    <div style={{ display: 'grid', gridTemplateColumns: isRelay ? '1fr 1fr' : '1fr 1fr', gap: '1rem' }}>
                      <div className="input-group">
                        <label className="input-label">{isRelay ? 'Team Name' : 'Player Name'}</label>
                        <input
                          type="text"
                          className="input-field"
                          placeholder={isRelay ? 'e.g. Team Alpha' : 'e.g. John Doe'}
                          value={entryForm.team_name}
                          onChange={e => setEntryForm(f => ({ ...f, team_name: e.target.value }))}
                          required
                        />
                      </div>
                      <div className="input-group">
                        <label className="input-label">⏱️ Time (seconds)</label>
                        <input
                          type="number"
                          step="0.001"
                          min="0.001"
                          className="input-field"
                          placeholder="e.g. 42.360"
                          value={entryForm.time_sec}
                          onChange={e => setEntryForm(f => ({ ...f, time_sec: e.target.value }))}
                          required
                        />
                      </div>
                    </div>

                    {isRelay && (
                      <div style={{ marginBottom: '1rem' }}>
                        <label className="input-label">Players (4 required)</label>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                          {[0, 1, 2, 3].map(i => (
                            <input
                              key={i}
                              type="text"
                              className="input-field"
                              placeholder={`Player ${i + 1}`}
                              value={entryForm.players[i] || ''}
                              onChange={e => {
                                const players = [...entryForm.players];
                                players[i] = e.target.value;
                                setEntryForm(f => ({ ...f, players }));
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
                      <label style={{
                        display: 'flex', alignItems: 'center', gap: '0.5rem',
                        cursor: 'pointer', fontSize: '0.88rem', color: entryForm.is_disqualified ? '#ef4444' : 'var(--color-text-muted)'
                      }}>
                        <input
                          type="checkbox"
                          checked={entryForm.is_disqualified}
                          onChange={e => setEntryForm(f => ({ ...f, is_disqualified: e.target.checked }))}
                        />
                        ⛔ Mark as Disqualified
                      </label>
                    </div>

                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                      <button type="button" className="btn-outline btn-sm" style={{ flex: 1 }} onClick={() => { setEntryForm(null); setEditingEntryId(null); }}>
                        Cancel
                      </button>
                      <button type="submit" className="btn-primary" style={{ flex: 2 }} disabled={saving}>
                        {saving ? 'Saving…' : editingEntryId ? 'Update Entry' : 'Add Entry'}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Leaderboard Table */}
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{
                  padding: '1rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.07)',
                  display: 'flex', alignItems: 'center', gap: '0.6rem'
                }}>
                  <span>🏆</span>
                  <h3 style={{ margin: 0, fontWeight: 700, fontSize: '0.95rem' }}>Live Leaderboard</h3>
                  <span style={{ marginLeft: 'auto', fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                    Auto-sorted by time ↑
                  </span>
                </div>

                {entries.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-muted)' }}>
                    <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>📋</div>
                    No entries yet. Add your first participant!
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                      <thead>
                        <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                          {['Rank', isRelay ? 'Team' : 'Name', isRelay && 'Players', '⏱️ Time', 'Status', !isFinalized && 'Actions']
                            .filter(Boolean)
                            .map(h => (
                              <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.72rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                {h}
                              </th>
                            ))}
                        </tr>
                      </thead>
                      <tbody>
                        {entries.map((entry, idx) => {
                          const rank = entry.rank;
                          const isDQ = entry.is_disqualified;
                          return (
                            <tr key={entry.id || idx} style={{
                              borderTop: '1px solid rgba(255,255,255,0.05)',
                              background: isDQ ? 'rgba(239,68,68,0.03)' : rank === 1 ? 'rgba(245,158,11,0.04)' : 'transparent',
                              opacity: isDQ ? 0.65 : 1,
                            }}>
                              {/* Rank */}
                              <td style={{ padding: '0.85rem 1rem' }}>
                                {isDQ ? (
                                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#ef4444', background: 'rgba(239,68,68,0.12)', padding: '2px 7px', borderRadius: '5px' }}>DQ</span>
                                ) : rank ? (
                                  <div style={{
                                    width: '32px', height: '32px', borderRadius: '8px',
                                    background: rank === 1 ? 'linear-gradient(135deg,#f59e0b,#d97706)'
                                      : rank === 2 ? 'linear-gradient(135deg,#94a3b8,#64748b)'
                                      : rank === 3 ? 'linear-gradient(135deg,#cd7f32,#a0522d)'
                                      : 'rgba(255,255,255,0.08)',
                                    color: rank <= 3 ? (rank === 1 ? '#000' : '#fff') : 'var(--color-text-muted)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontWeight: 800, fontSize: '0.85rem',
                                  }}>
                                    {RANK_MEDAL[rank] || rank}
                                  </div>
                                ) : (
                                  <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>—</span>
                                )}
                              </td>

                              {/* Name */}
                              <td style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>{entry.team_name}</td>

                              {/* Players (relay) */}
                              {isRelay && (
                                <td style={{ padding: '0.85rem 1rem' }}>
                                  <div style={{ fontSize: '0.77rem', color: 'var(--color-text-muted)', lineHeight: 1.7 }}>
                                    {(entry.players || []).filter(Boolean).join(' · ') || '—'}
                                  </div>
                                </td>
                              )}

                              {/* Time */}
                              <td style={{ padding: '0.85rem 1rem' }}>
                                {entry.time_sec > 0 ? (
                                  <span style={{
                                    fontFamily: 'monospace', fontWeight: 700,
                                    color: rank === 1 ? '#f59e0b' : rank === 2 ? '#94a3b8' : rank === 3 ? '#cd7f32' : 'var(--color-primary)',
                                    fontSize: '1rem',
                                  }}>
                                    {Number(entry.time_sec).toFixed(3)}s
                                  </span>
                                ) : (
                                  <span style={{ color: 'var(--color-text-muted)' }}>—</span>
                                )}
                              </td>

                              {/* Status */}
                              <td style={{ padding: '0.85rem 1rem' }}>
                                {isDQ ? (
                                  <span style={{ fontSize: '0.75rem', color: '#ef4444', fontWeight: 700 }}>⛔ DQ'd</span>
                                ) : (
                                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Active</span>
                                )}
                              </td>

                              {/* Actions */}
                              {!isFinalized && (
                                <td style={{ padding: '0.85rem 1rem' }}>
                                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                                    <button
                                      className="btn-outline btn-sm"
                                      style={{ padding: '0.3rem 0.7rem', fontSize: '0.78rem' }}
                                      onClick={() => openEditEntry(entry)}
                                    >
                                      ✏️
                                    </button>
                                    <button
                                      className="btn-outline btn-sm"
                                      style={{ padding: '0.3rem 0.7rem', fontSize: '0.78rem', color: '#ef4444', borderColor: '#ef4444' }}
                                      onClick={() => handleDeleteEntry(entry.id)}
                                    >
                                      🗑️
                                    </button>
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
