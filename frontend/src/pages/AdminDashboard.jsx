import React, { useState, useEffect, useRef } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import api from '../api';
import { SPORTS } from '../sports/sportsConfig';
import { useMatchSocket } from '../hooks/useMatchSocket';

function AdminDashboard() {
  const { user, authLoading } = useAuth();
  const [matches, setMatches] = useState([]);
  const [teams, setTeams] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [activeSection, setActiveSection] = useState('matches');
  const [matchDateFilter, setMatchDateFilter] = useState('');
  const [matchSportFilter, setMatchSportFilter] = useState('');

  // Form states
  const [newTeam, setNewTeam] = useState({ name: '', sport_id: 'athletics', squad: [] });
  const [tempPlayerName, setTempPlayerName] = useState('');
  const [newMatch, setNewMatch] = useState({ sport_id: 'athletics', team1_id: '', team2_id: '', scheduled_time: '' });
  const [newAdmin, setNewAdmin] = useState({ username: '', password: '' });
  const [adminMsg, setAdminMsg] = useState('');
  const [dqReason, setDqReason] = useState({});
  const teamsRefreshTimeoutRef = useRef(null);

  const sportsEnum = ['athletics', 'cricket', 'volleyball', 'football', 'carrom', 'chess', 'arm-wrestling', 'weight-lifting', 'kho-kho', 'badminton', 'table-tennis', 'tug-of-war', 'esports'];

  const getLocalDateKey = (dateValue) => {
    if (!dateValue) return '';
    const d = new Date(dateValue);
    if (Number.isNaN(d.getTime())) return '';
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const filteredMatches = matches.filter((m) => {
    if (matchDateFilter && getLocalDateKey(m.scheduled_time) !== matchDateFilter) return false;
    if (matchSportFilter && m.sport_id !== matchSportFilter) return false;
    return true;
  });

  useEffect(() => {
    if (user) {
      fetchMatches();
      fetchTeams();
      fetchAdmins();
    }
  }, [user]);

  useMatchSocket((updatedMatch) => {
    setMatches((prev) => {
      const idx = prev.findIndex((m) => m.id === updatedMatch.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = updatedMatch;
        return next;
      }
      return [...prev, updatedMatch].sort((a, b) => new Date(a.scheduled_time) - new Date(b.scheduled_time));
    });

    // Team points can change when match status/result changes; debounce to avoid request spam during live scoring.
    if (teamsRefreshTimeoutRef.current) clearTimeout(teamsRefreshTimeoutRef.current);
    teamsRefreshTimeoutRef.current = setTimeout(() => {
      fetchTeams();
    }, 500);
  });

  useEffect(() => {
    return () => {
      if (teamsRefreshTimeoutRef.current) clearTimeout(teamsRefreshTimeoutRef.current);
    };
  }, []);

  const fetchMatches = async () => {
    try {
      const res = await api.get('/matches');
      setMatches(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchTeams = async () => {
    try {
      const res = await api.get('/teams');
      setTeams(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchAdmins = async () => {
    try {
      const res = await api.get('/admins');
      setAdmins(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddTeam = async (e) => {
    e.preventDefault();

    if (newTeam.sport_id === 'volleyball') {
      const players = (newTeam.squad || []).filter(p => !p.is_substitute);
      const subs = (newTeam.squad || []).filter(p => p.is_substitute);
      if (players.length !== 6) {
        alert(`A volleyball team must have exactly 6 main players. Currently you have ${players.length}.`);
        return;
      }
      if (subs.length > 3) {
        alert(`A volleyball team can have a maximum of 3 substitutes. Currently you have ${subs.length}.`);
        return;
      }
    }

    try {
      await api.post('/teams', newTeam);
      fetchTeams();
      setNewTeam({ name: '', sport_id: 'athletics', squad: [] });
    } catch (e) {
      alert('Error adding team');
    }
  };

  const addPlayerToSquad = (isSubstitute = false) => {
    if (tempPlayerName.trim()) {
      setNewTeam(prev => ({ ...prev, squad: [...(prev.squad || []), { name: tempPlayerName, is_substitute: isSubstitute }] }));
      setTempPlayerName('');
    }
  };

  const removePlayerFromSquad = (idx) => {
    setNewTeam(prev => ({ ...prev, squad: prev.squad.filter((_, i) => i !== idx) }));
  };

  const handleAddMatch = async (e) => {
    e.preventDefault();
    try {
      await api.post('/matches', newMatch);
      fetchMatches();
    } catch (e) {
      alert('Error creating match');
    }
  };

  const handleDeleteMatch = async (id) => {
    try {
      await api.delete(`/matches/${id}`);
      fetchMatches();
    } catch (e) {
      console.error(e);
      alert(e.response?.data?.detail || e.message || 'Error deleting match. Check console for details.');
    }
  };

  const handleAddAdmin = async (e) => {
    e.preventDefault();
    setAdminMsg('');
    try {
      await api.post('/admins', newAdmin);
      fetchAdmins();
      setNewAdmin({ username: '', password: '' });
      setAdminMsg('Admin created successfully!');
    } catch (e) {
      setAdminMsg(e.response?.data?.detail || 'Error creating admin');
    }
  };

  const handleDeleteAdmin = async (id) => {
    try {
      await api.delete(`/admins/${id}`);
      fetchAdmins();
    } catch (e) {
      alert(e.response?.data?.detail || 'Error removing admin');
    }
  };

  const handleDisqualify = async (teamId) => {
    const reason = dqReason[teamId] || '';
    if (!reason.trim()) { alert('Please enter a reason for disqualification.'); return; }
    try {
      await api.put(`/teams/${teamId}/disqualify`, { reason });
      fetchTeams();
      setDqReason(prev => ({ ...prev, [teamId]: '' }));
    } catch (e) {
      alert(e.response?.data?.detail || 'Error disqualifying team');
    }
  };

  const handleReinstate = async (teamId) => {
    try {
      await api.put(`/teams/${teamId}/reinstate`);
      fetchTeams();
    } catch (e) {
      alert(e.response?.data?.detail || 'Error reinstating team');
    }
  };

  const handleDeleteTeam = async (teamId) => {
    try {
      await api.delete(`/teams/${teamId}`);
      fetchTeams();
      fetchMatches();
    } catch (e) {
      console.error(e);
      alert(e.response?.data?.detail || e.message || 'Error deleting team');
    }
  };

  if (authLoading) {
    return <div className="container"><p style={{ color: 'var(--color-text-muted)' }}>Checking admin session…</p></div>;
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title">Admin Command Center</h1>
      </div>

      {/* Section Tabs */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0' }}>
        {['matches', 'teams', 'admins'].map(section => (
          <button
            key={section}
            className="nav-link"
            onClick={() => setActiveSection(section)}
            style={{
              padding: '1rem 1.5rem',
              borderBottom: activeSection === section ? '2px solid var(--color-primary)' : '2px solid transparent',
              color: activeSection === section ? 'var(--color-text-main)' : 'var(--color-text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '1px',
              fontSize: '1rem',
            }}
          >
            {section === 'matches' ? '🏟️ Matches' : section === 'teams' ? '👥 Teams' : '🔐 Admin Users'}
          </button>
        ))}
      </div>

      {/* MATCHES SECTION */}
      {activeSection === 'matches' && (
        <>
          <div className="card" style={{ marginBottom: '2rem' }}>
            <h2>Sport score desks</h2>
            <p style={{ color: 'var(--color-text-muted)', marginTop: '0.5rem', fontSize: '0.95rem' }}>
              Each sport has its own scoreboard layout and fields. Open a desk to update live scores and status.
            </p>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
                gap: '0.75rem',
                marginTop: '1.25rem',
              }}
            >
              {SPORTS.map((s) => (
                <Link key={s.id} to={`/admin/score/${s.id}`} className="btn-outline btn-sm" style={{ textAlign: 'center' }}>
                  {s.icon} {s.name}
                </Link>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: '4rem' }}>
            <div className="card">
              <h2>Schedule Match</h2>
              <p style={{ color: 'var(--color-text-muted)', marginTop: '0.5rem', fontSize: '0.95rem' }}>
                Select a sport to schedule a new dedicated match setup.
              </p>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
                  gap: '0.75rem',
                  marginTop: '1.25rem',
                }}
              >
                {SPORTS.map((s) => (
                  <Link key={s.id} to={`/admin/create-match/${s.id}`} className="btn-outline btn-sm" style={{ textAlign: 'center', borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }}>
                    ➕ {s.icon} {s.name}
                  </Link>
                ))}
              </div>
            </div>
          </div>

          <h2>Manage Matches</h2>
          <div className="card" style={{ marginTop: '1rem' }}>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label className="input-label">Filter by Date</label>
                <input
                  type="date"
                  className="input-field"
                  value={matchDateFilter}
                  onChange={(e) => setMatchDateFilter(e.target.value)}
                  style={{ maxWidth: '240px' }}
                />
              </div>

              <div className="input-group" style={{ marginBottom: 0 }}>
                <label className="input-label">Filter by Sport</label>
                <select
                  className="input-field"
                  value={matchSportFilter}
                  onChange={(e) => setMatchSportFilter(e.target.value)}
                  style={{ maxWidth: '260px' }}
                >
                  <option value="">All</option>
                  {sportsEnum.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                className="btn-outline btn-sm"
                onClick={() => {
                  setMatchDateFilter('');
                  setMatchSportFilter('');
                }}
                style={{ height: 'fit-content' }}
              >
                Clear
              </button>
            </div>
          </div>
          <div className="card" style={{ marginTop: '1rem', overflowX: 'auto' }}>
            <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', whiteSpace: 'nowrap' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <th style={{ padding: '1rem' }}>Sport</th>
                  <th style={{ padding: '1rem' }}>Teams</th>
                  <th style={{ padding: '1rem' }}>Status</th>
                  <th style={{ padding: '1rem' }}>Summary</th>
                  <th style={{ padding: '1rem' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredMatches.map(m => (
                  <tr key={m.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td style={{ padding: '1rem' }}>{m.sport_id}</td>
                    <td style={{ padding: '1rem' }}>{m.team1} vs {m.team2}</td>
                    <td style={{ padding: '1rem', textTransform: 'capitalize' }}>{m.status}</td>
                    <td style={{ padding: '1rem' }}>
                      {m.score_t1} — {m.score_t2}
                      <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
                        Canonical (for points)
                      </span>
                    </td>
                    <td style={{ padding: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <Link to={`/admin/score/${m.sport_id}?match=${m.id}`} className="btn-outline btn-sm">
                        Edit score
                      </Link>
                      <button 
                        className="btn-outline btn-sm"
                        onClick={() => handleDeleteMatch(m.id)}
                        style={{ color: '#ff4444', borderColor: '#ff4444' }}
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* TEAMS MANAGEMENT SECTION */}
      {activeSection === 'teams' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '3rem' }}>
            <div className="card">
              <h2>Add New Team & Roster</h2>
              <form onSubmit={handleAddTeam} style={{ marginTop: '1rem' }}>
                <div className="input-group">
                  <label className="input-label">Sport</label>
                  <select className="input-field" value={newTeam.sport_id} onChange={e => setNewTeam({...newTeam, sport_id: e.target.value})}>
                    {sportsEnum.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                
                {!['cricket', 'volleyball', 'badminton', 'table-tennis'].includes(newTeam.sport_id) ? (
                  <>
                    <div className="input-group">
                      <label className="input-label">Team Name / Player Name</label>
                      <input type="text" className="input-field" value={newTeam.name} onChange={e => setNewTeam({...newTeam, name: e.target.value})} required />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="input-group">
                      <label className="input-label">Team Name</label>
                      <input type="text" className="input-field" value={newTeam.name} onChange={e => setNewTeam({...newTeam, name: e.target.value})} required />
                    </div>
                    
                    <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', marginBottom: '1.5rem', border: '1px solid rgba(255,255,255,0.1)' }}>
                      <h4>Team Squad ({newTeam.squad?.length || 0})</h4>
                      <ul style={{ listStyle: 'none', padding: 0, margin: '0.5rem 0', fontSize: '0.85rem' }}>
                        {newTeam.squad?.map((p, i) => (
                          <li key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.3rem 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            <span>
                              {p.name}
                              {p.is_substitute && <span style={{ color: 'var(--color-primary)', fontSize: '0.75rem', marginLeft: '0.5rem' }}>[Substitute]</span>}
                            </span>
                            <button type="button" onClick={() => removePlayerFromSquad(i)} style={{ background: 'transparent', border: 'none', color: '#ff4444', cursor: 'pointer' }}>×</button>
                          </li>
                        ))}
                      </ul>
                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                        <input type="text" className="input-field" style={{ flex: 1, padding: '0.5rem' }} placeholder="Player Name" value={tempPlayerName} onChange={e => setTempPlayerName(e.target.value)} />
                        <button type="button" className="btn-outline btn-sm" onClick={() => addPlayerToSquad(false)}>Add Player</button>
                        <button type="button" className="btn-outline btn-sm" onClick={() => addPlayerToSquad(true)}>Add Sub</button>
                      </div>
                    </div>
                  </>
                )}

                <button className="btn-primary" style={{ width: '100%' }}>Register Team</button>
              </form>
            </div>
          </div>

          <h2>All Teams</h2>
          <div className="card" style={{ marginTop: '1rem', overflowX: 'auto' }}>
            <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <th style={{ padding: '1rem' }}>Team</th>
                  <th style={{ padding: '1rem' }}>Sport</th>
                  <th style={{ padding: '1rem' }}>Points</th>
                  <th style={{ padding: '1rem' }}>Status</th>
                  <th style={{ padding: '1rem' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {teams.map(t => (
                  <tr key={t.id} style={{ borderBottom: '1px solid var(--color-border)', opacity: t.is_disqualified ? 0.6 : 1 }}>
                    <td style={{ padding: '1rem', fontWeight: 'bold' }}>{t.name}</td>
                    <td style={{ padding: '1rem', textTransform: 'capitalize' }}>{t.sport_id.replace('-', ' ')}</td>
                    <td style={{ padding: '1rem' }}>{t.points}</td>
                    <td style={{ padding: '1rem' }}>
                      {t.is_disqualified ? (
                        <div>
                          <span style={{ color: '#ff4444', fontWeight: 'bold', fontSize: '0.85rem' }}>⛔ DISQUALIFIED</span>
                          <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
                            Reason: {t.disqualification_reason}
                          </div>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--color-success)', fontWeight: 'bold', fontSize: '0.85rem' }}>✅ Active</span>
                      )}
                    </td>
                    <td style={{ padding: '1rem' }}>
                      {t.is_disqualified ? (
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                          <button
                            className="btn-outline btn-sm"
                            onClick={() => handleReinstate(t.id)}
                            style={{ color: 'var(--color-success)', borderColor: 'var(--color-success)' }}
                          >
                            Reinstate
                          </button>
                          <button
                            className="btn-outline btn-sm"
                            onClick={() => handleDeleteTeam(t.id)}
                            style={{ color: '#ff4444', borderColor: '#ff4444' }}
                          >
                            Delete
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          <input
                            type="text"
                            className="input-field"
                            placeholder="Reason..."
                            value={dqReason[t.id] || ''}
                            onChange={e => setDqReason(prev => ({ ...prev, [t.id]: e.target.value }))}
                            style={{ padding: '0.3rem 0.5rem', fontSize: '0.85rem', width: '140px' }}
                          />
                          <button
                            className="btn-outline btn-sm"
                            onClick={() => handleDisqualify(t.id)}
                            style={{ color: '#ff4444', borderColor: '#ff4444', whiteSpace: 'nowrap' }}
                          >
                            Disqualify
                          </button>
                          <button
                            className="btn-outline btn-sm"
                            onClick={() => handleDeleteTeam(t.id)}
                            style={{ color: '#ff4444', borderColor: '#ff4444' }}
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ADMIN MANAGEMENT SECTION */}
      {activeSection === 'admins' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
          <div className="card">
            <h2>Create New Admin</h2>
            <p style={{ color: 'var(--color-text-muted)', marginTop: '0.5rem', fontSize: '0.9rem' }}>
              Grant admin access to another user. They will be able to manage matches, teams, and scores.
            </p>
            {adminMsg && (
              <div style={{
                marginTop: '1rem',
                padding: '0.75rem',
                borderRadius: '4px',
                background: adminMsg.includes('success') ? 'rgba(0, 255, 102, 0.1)' : 'var(--color-primary-dim)',
                color: adminMsg.includes('success') ? 'var(--color-success)' : 'var(--color-primary)',
                fontSize: '0.9rem',
              }}>
                {adminMsg}
              </div>
            )}
            <form onSubmit={handleAddAdmin} style={{ marginTop: '1.5rem' }}>
              <div className="input-group">
                <label className="input-label">Username</label>
                <input
                  type="text"
                  className="input-field"
                  value={newAdmin.username}
                  onChange={e => setNewAdmin({ ...newAdmin, username: e.target.value })}
                  placeholder="Enter new admin username"
                  required
                />
              </div>
              <div className="input-group">
                <label className="input-label">Password</label>
                <input
                  type="password"
                  className="input-field"
                  value={newAdmin.password}
                  onChange={e => setNewAdmin({ ...newAdmin, password: e.target.value })}
                  placeholder="Set a strong password"
                  required
                />
              </div>
              <button className="btn-primary" style={{ width: '100%' }}>Create Admin</button>
            </form>
          </div>

          <div className="card">
            <h2>Current Admins</h2>
            <p style={{ color: 'var(--color-text-muted)', marginTop: '0.5rem', fontSize: '0.9rem' }}>
              {admins.length} admin account{admins.length !== 1 ? 's' : ''} registered. The root "admin" account cannot be removed.
            </p>
            <div style={{ marginTop: '1.5rem' }}>
              {admins.map(a => (
                <div
                  key={a.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '1rem',
                    borderBottom: '1px solid var(--color-border)',
                  }}
                >
                  <div>
                    <span style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{a.username}</span>
                    {a.username === 'admin' && (
                      <span style={{
                        marginLeft: '0.75rem',
                        fontSize: '0.7rem',
                        padding: '0.2rem 0.5rem',
                        borderRadius: '4px',
                        background: 'var(--color-primary-dim)',
                        color: 'var(--color-primary)',
                        textTransform: 'uppercase',
                        letterSpacing: '1px',
                      }}>
                        Root
                      </span>
                    )}
                  </div>
                  {a.username !== 'admin' && (
                    <button
                      className="btn-outline btn-sm"
                      onClick={() => handleDeleteAdmin(a.id)}
                      style={{ color: '#ff4444', borderColor: '#ff4444' }}
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminDashboard;
