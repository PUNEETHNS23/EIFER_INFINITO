import { useState, useEffect, useRef } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import api from '../api';
import { SPORTS, CATEGORY_SPORTS, getSportCategories, getSquadLimits } from '../sports/sportsConfig';
import { useMatchSocket } from '../hooks/useMatchSocket';
import './AdminDashboard.css';

function AdminDashboard() {
  const { user, authLoading } = useAuth();
  const [matches, setMatches] = useState([]);
  const [teams, setTeams] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [activeSection, setActiveSection] = useState('matches');
  const [matchDateFilter, setMatchDateFilter] = useState('');
  const [matchSportFilter, setMatchSportFilter] = useState('');
  const [teamSportFilter, setTeamSportFilter] = useState('');
  const [teamCategoryFilter, setTeamCategoryFilter] = useState('');
  const [selectedSportForTeam, setSelectedSportForTeam] = useState(null);

  // Form states
  const allowedSports = user?.allowed_sports || [];
  const isGeneralAdmin = user?.username === 'general_admin';
  const canAccessSport = (sportId) => allowedSports.length === 0 || allowedSports.includes(sportId);
  const defaultSportId = allowedSports[0] || 'cricket';

  const createTeamState = (sportId = defaultSportId, category = '') => ({
    name: '',
    sport_id: sportId,
    category,
    squad: [],
  });

  const resetTeamFormForSport = (sportId) => {
    const categories = getSportCategories(sportId);
    const initialCategory = sportId === 'weight-lifting' ? '' : (categories[0] || '');
    setNewTeam(createTeamState(sportId, initialCategory));
  };

  const [newTeam, setNewTeam] = useState(createTeamState(defaultSportId));
  const [tempPlayerName, setTempPlayerName] = useState('');
  const [newAdmin, setNewAdmin] = useState({ username: '', password: '', allowed_sports: [] });
  const [adminMsg, setAdminMsg] = useState('');
  const [dqReason, setDqReason] = useState({});
  const teamsRefreshTimeoutRef = useRef(null);

  const categorizedSports = Object.keys(CATEGORY_SPORTS);

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

  const filteredTeams = teams.filter((t) => {
    if (teamSportFilter && t.sport_id !== teamSportFilter) return false;
    if (teamCategoryFilter && (t.category || '') !== teamCategoryFilter) return false;
    return true;
  });

  useEffect(() => {
    if (user) {
      fetchMatches();
      fetchTeams();
      if (isGeneralAdmin) {
        fetchAdmins();
      }
    }
  }, [user, isGeneralAdmin]);

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

    // SQUAD VALIDATION
    const limits = getSquadLimits(newTeam.sport_id, newTeam.category);
    const mainCount = (newTeam.squad || []).filter(p => !p.is_substitute).length;
    const subCount = (newTeam.squad || []).filter(p => p.is_substitute).length;

    if (newTeam.sport_id !== 'tug-of-war') {
      if (mainCount !== limits.main) {
        alert(`${newTeam.sport_id} ${newTeam.category || ''} requires exactly ${limits.main} main player(s). You have ${mainCount}.`);
        return;
      }
      if (subCount > limits.sub) {
        alert(`${newTeam.sport_id} allows at most ${limits.sub} substitute(s). You have ${subCount}.`);
        return;
      }
    }

    try {
      await api.post('/teams', {
        name: newTeam.name,
        sport_id: newTeam.sport_id,
        category: newTeam.sport_id === 'weight-lifting' ? null : (newTeam.category || null),
        squad: newTeam.squad,
      });
      fetchTeams();
      resetTeamFormForSport(selectedSportForTeam || newTeam.sport_id);
    } catch {
      alert('Error adding team');
    }
  };

  const addPlayerToSquad = (isSubstitute = false) => {
    if (!tempPlayerName.trim()) return;

    const limits = getSquadLimits(newTeam.sport_id, newTeam.category);
    const squad = newTeam.squad || [];
    const mainCount = squad.filter(p => !p.is_substitute).length;
    const subCount = squad.filter(p => p.is_substitute).length;

    if (!isSubstitute && mainCount >= limits.main) {
      alert(`Main player limit reached for ${newTeam.sport_id}.`);
      return;
    }
    if (isSubstitute && subCount >= limits.sub) {
      alert(`Substitute limit reached for ${newTeam.sport_id}.`);
      return;
    }

    setNewTeam(prev => ({ 
      ...prev, 
      squad: [...(prev.squad || []), { name: tempPlayerName.trim(), is_substitute: isSubstitute }] 
    }));
    setTempPlayerName('');
  };

  const removePlayerFromSquad = (idx) => {
    setNewTeam(prev => ({ ...prev, squad: prev.squad.filter((_, i) => i !== idx) }));
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
      setNewAdmin({ username: '', password: '', allowed_sports: [] });
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
      <div className="admin-tabs-container">
        {['matches', 'teams', ...(isGeneralAdmin ? ['admins'] : [])].map(section => (
          <button
            key={section}
            className={`admin-tab ${activeSection === section ? 'active' : ''}`}
            onClick={() => setActiveSection(section)}
          >
            {section === 'matches' ? '🏟️ Matches' : section === 'teams' ? '👥 Teams' : '🔐 Admin Users'}
          </button>
        ))}
      </div>

      {/* MATCHES SECTION */}
      {activeSection === 'matches' && (
        <>
          <div className="card" style={{ marginBottom: '2rem' }}>
            <h2 className="admin-section-title">Sport score desks</h2>
            <p className="admin-section-desc">
              Each sport has its own scoreboard layout and fields. Open a desk to update live scores and status.
            </p>
            <div className="admin-grid-desks">
              {SPORTS.filter((s) => canAccessSport(s.id)).map((s) => (
                s.id === 'athletics' ? (
                  <Link key={s.id} to="/admin/athletics" className="btn-outline btn-sm" style={{ textAlign: 'center', borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }}>
                    {s.icon} {s.name}
                  </Link>
                ) : s.id === 'weight-lifting' ? (
                  <Link key={s.id} to="/admin/weight-lifting" className="btn-outline btn-sm" style={{ textAlign: 'center', borderColor: '#a78bfa', color: '#a78bfa' }}>
                    {s.icon} {s.name}
                  </Link>
                ) : (
                  <Link key={s.id} to={`/admin/score/${s.id}`} className="btn-outline btn-sm" style={{ textAlign: 'center' }}>
                    {s.icon} {s.name}
                  </Link>
                )
              ))}
            </div>
          </div>

{/*
          <div className="card" style={{ marginBottom: '2rem' }}>
            <h2 className="admin-section-title">Automatic match scheduling</h2>
            <p className="admin-section-desc">
              Create bulk randomized matches for any sport. Team compositions are auto-generated from squads (for applicable sports) and fully editable before saving.
            </p>
            <div className="admin-grid-desks">
              {SPORTS.filter(s => !['weight-lifting', 'athletics'].includes(s.id)).map((s) => (
                <Link
                  key={s.id}
                  to={`/admin/automatic-schedule/${s.id}`}
                  className="btn-outline btn-sm"
                  style={{ textAlign: 'center', borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }}
                >
                  ➕ {s.icon} {s.name}
                </Link>
              ))}
            </div>
          </div>
*/}

          <div className="card" style={{ marginBottom: '2rem', borderColor: 'rgba(245,158,11,0.3)', background: 'linear-gradient(135deg,rgba(245,158,11,0.05),rgba(99,102,241,0.05))' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '0.75rem' }}>
              <div>
                <h2 className="admin-section-title" style={{ margin: 0 }}>🏆 Events & Scheduling</h2>
                <p className="admin-section-desc" style={{ marginBottom: 0 }}>
                  Generate single-elimination brackets with automatic BYE handling. Drag &amp; drop teams, set match times &amp; venues, and link directly to live score desks.
                </p>
              </div>
              <Link to="/admin/tournament" className="btn-primary" style={{ whiteSpace: 'nowrap' }}>
                ⚡ Open Event Manager
              </Link>
            </div>
            <div className="admin-grid-desks" style={{ marginTop: '0.5rem' }}>
              {SPORTS.filter(s => ['cricket','volleyball','football','badminton','table-tennis','chess','carrom','tug-of-war','kho-kho','arm-wrestling'].includes(s.id) && canAccessSport(s.id)).map(s => (
                <Link key={s.id} to={`/admin/tournament/${s.id}`}
                  className="btn-outline btn-sm"
                  style={{ textAlign: 'center', borderColor: 'rgba(245,158,11,0.4)', color: '#f59e0b' }}>
                  🏆 {s.icon} {s.name}
                </Link>
              ))}
            </div>
          </div>


          <h2>Manage Matches</h2>
          <div className="card" style={{ marginTop: '1rem' }}>
            <div className="admin-filter-bar">
              <div className="input-group form-group-compact">
                <label className="input-label">Filter by Date</label>
                <input
                  type="date"
                  className="input-field"
                  value={matchDateFilter}
                  onChange={(e) => setMatchDateFilter(e.target.value)}
                />
              </div>

              <div className="input-group form-group-compact">
                <label className="input-label">Filter by Sport</label>
                <select
                  className="input-field"
                  value={matchSportFilter}
                  onChange={(e) => setMatchSportFilter(e.target.value)}
                >
                  <option value="">All</option>
                  {SPORTS.filter((s) => canAccessSport(s.id)).map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
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
          <div className="card" style={{ marginTop: '1rem' }}>
            <div className="table-responsive">
              <table className="leaderboard-table">
                <thead>
                  <tr>
                    <th>Sport</th>
                    <th>Teams</th>
                    <th>Status</th>
                    <th>Summary</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMatches.map(m => (
                    <tr key={m.id}>
                      <td>{m.sport_id}</td>
                      <td>{m.team1} vs {m.team2}</td>
                      <td style={{ textTransform: 'capitalize' }}>{m.status}</td>
                      <td>
                        {m.score_t1} — {m.score_t2}
                        <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
                          Canonical (for points)
                        </span>
                      </td>
                      <td>
                        <div className="admin-actions-cell">
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
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* TEAMS MANAGEMENT SECTION */}
      {activeSection === 'teams' && (
        <>
          <div className="card" style={{ marginBottom: '1.5rem', background: 'rgba(255,255,255,0.02)' }}>
            {!selectedSportForTeam ? (
              <>
                <h2 className="admin-section-title">Step 1: Select Sport to Create Team</h2>
                <div className="admin-grid-desks">
                  {SPORTS.filter((s) => canAccessSport(s.id)).map((s) => (
                    <button
                      key={s.id}
                      onClick={() => {
                        setSelectedSportForTeam(s.id);
                        resetTeamFormForSport(s.id);
                      }}
                      className="btn-outline btn-sm"
                      style={{ textAlign: 'center', borderColor: 'rgba(255,255,255,0.1)', color: 'var(--color-text)' }}
                    >
                      {s.icon} {s.name}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <button onClick={() => setSelectedSportForTeam(null)} className="btn-outline btn-sm">← Back</button>
                  <h2 className="admin-section-title" style={{ marginBottom: 0 }}>
                    {SPORTS.find(s => s.id === selectedSportForTeam)?.icon} Create {SPORTS.find(s => s.id === selectedSportForTeam)?.name} Team
                  </h2>
                </div>
              </div>
            )}
          </div>

          {selectedSportForTeam && (
            <div className="admin-form-two-col">
              <div className="card">
                <form onSubmit={handleAddTeam}>
                  <div className="input-group">
                    <label className="input-label">Team Name</label>
                    <input 
                      type="text" 
                      className="input-field" 
                      placeholder="e.g. CS24" 
                      value={newTeam.name} 
                      onChange={e => setNewTeam({...newTeam, name: e.target.value})} 
                      required 
                    />
                  </div>

                  {categorizedSports.includes(newTeam.sport_id) && newTeam.sport_id !== 'weight-lifting' && (
                    <div className="input-group">
                      <label className="input-label">Subcategory</label>
                      <select
                        className="input-field"
                        value={newTeam.category || getSportCategories(newTeam.sport_id)[0] || ''}
                        onChange={(e) => {
                          const nextCategory = e.target.value;
                          setNewTeam((prev) => ({ 
                            ...prev, 
                            category: nextCategory,
                            squad: [] // Reset squad when category changes to enforce new limits
                          }));
                        }}
                      >
                        {getSportCategories(newTeam.sport_id).map((cat) => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>
                  )}
                    
                    {(() => {
                      const limits = getSquadLimits(newTeam.sport_id, newTeam.category);
                      const squad = newTeam.squad || [];
                      const mainCount = squad.filter(p => !p.is_substitute).length;
                      const subCount = squad.filter(p => p.is_substitute).length;
                      
                      const canAddMain = mainCount < limits.main;
                      const canAddSub = subCount < limits.sub;


                      return (
                        <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', marginBottom: '1.5rem', border: '1px solid rgba(255,255,255,0.1)' }}>
                          <h4 className="admin-section-title" style={{ fontSize: '1.1rem' }}>
                            Team Squad ({newTeam.squad?.length || 0})
                          </h4>
                          <p style={{ margin: '0.25rem 0 0.6rem', color: 'var(--color-primary)', fontSize: '0.85rem' }}>
                            Limit: {limits.main} Main {limits.sub > 0 && `+ ${limits.sub} Subs`}
                          </p>
                          <ul className="admin-squad-list">
                            {newTeam.squad?.map((p, i) => (
                              <li key={i} className="admin-squad-item">
                                <span>
                                  {p.name}
                                  {p.is_substitute && <span style={{ color: 'var(--color-primary)', fontSize: '0.75rem', marginLeft: '0.5rem' }}>[Substitute]</span>}
                                </span>
                                <button type="button" onClick={() => removePlayerFromSquad(i)} className="player-remove-btn">×</button>
                              </li>
                            ))}
                          </ul>
                          
                          {(canAddMain || canAddSub) ? (
                            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                              <input
                                type="text"
                                className="input-field"
                                style={{ flex: 1, padding: '0.5rem' }}
                                placeholder="Player Name"
                                value={tempPlayerName}
                                onChange={e => setTempPlayerName(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                  }
                                }}
                              />
                              {canAddMain && (
                                <button type="button" className="btn-outline btn-sm" onClick={() => addPlayerToSquad(false)}>Add Player</button>
                              )}
                              {canAddSub && (
                                <button type="button" className="btn-outline btn-sm" onClick={() => addPlayerToSquad(true)}>Add Sub</button>
                              )}
                            </div>
                          ) : (
                            <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                              Player and substitute limit reached for this sport.
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    <button className="btn-primary" style={{ width: '100%' }}>Register Team</button>
                  </form>
                </div>
              </div>
            )}

          <h2>All Teams</h2>
          <div className="card" style={{ marginTop: '1rem' }}>
            <div className="admin-filter-bar">
              <div className="input-group form-group-compact">
                <label className="input-label">Filter by Sport</label>
                <select
                  className="input-field"
                  value={teamSportFilter}
                  onChange={(e) => {
                    const nextSport = e.target.value;
                    setTeamSportFilter(nextSport);
                    if (!categorizedSports.includes(nextSport)) {
                      setTeamCategoryFilter('');
                    }
                  }}
                  style={{ minWidth: '200px' }}
                >
                  {SPORTS.filter((s) => canAccessSport(s.id)).map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div className="input-group form-group-compact">
                <label className="input-label">Filter by Category</label>
                <select
                  className="input-field"
                  value={teamCategoryFilter}
                  onChange={(e) => setTeamCategoryFilter(e.target.value)}
                  disabled={teamSportFilter !== '' && !categorizedSports.includes(teamSportFilter)}
                  style={{ minWidth: '200px' }}
                >
                  <option value="">All</option>
                  {(teamSportFilter && categorizedSports.includes(teamSportFilter) ? getSportCategories(teamSportFilter) : getSportCategories('badminton')).map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                className="btn-outline btn-sm"
                onClick={() => {
                  setTeamSportFilter('');
                  setTeamCategoryFilter('');
                }}
                style={{ height: 'fit-content' }}
              >
                Clear
              </button>
            </div>
          </div>
          <div className="card" style={{ marginTop: '1rem' }}>
            <div className="table-responsive">
              <table className="leaderboard-table">
                <thead>
                  <tr>
                    <th>Team</th>
                    <th>Sport</th>
                    <th>Category</th>
                    <th>Points</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTeams.map(t => (
                    <tr key={t.id} style={{ opacity: t.is_disqualified ? 0.6 : 1 }}>
                      <td className="team-name-cell">{t.name}</td>
                      <td style={{ textTransform: 'capitalize' }}>{t.sport_id.replace('-', ' ')}</td>
                      <td>{t.sport_id === 'weight-lifting' ? '-' : (t.category || '-')}</td>
                      <td className="points-cell">{t.points}</td>
                      <td>
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
                      <td>
                        <div className="admin-actions-cell">
                          {t.is_disqualified ? (
                            <>
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
                            </>
                          ) : (
                            <>
                              <input
                                type="text"
                                className="input-field"
                                placeholder="Reason..."
                                value={dqReason[t.id] || ''}
                                onChange={e => setDqReason(prev => ({ ...prev, [t.id]: e.target.value }))}
                                style={{ padding: '0.3rem 0.5rem', fontSize: '0.85rem', width: '120px' }}
                              />
                              <button
                                className="btn-outline btn-sm"
                                onClick={() => handleDisqualify(t.id)}
                                style={{ color: '#ff4444', borderColor: '#ff4444' }}
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
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ADMIN MANAGEMENT SECTION */}
      {activeSection === 'admins' && (
        <div className="admin-form-two-col">
          <div className="card">
            <h2 className="admin-section-title">Create New Admin</h2>
            <p className="admin-section-desc">
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
              <div className="input-group">
                <label className="input-label">Allowed Sports</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.6rem' }}>
                  {SPORTS.map((sport) => (
                    <label key={sport.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.65rem 0.75rem', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '12px', cursor: 'pointer', opacity: canAccessSport(sport.id) ? 1 : 0.45 }}>
                      <input
                        type="checkbox"
                        checked={newAdmin.allowed_sports.includes(sport.id)}
                        disabled={!canAccessSport(sport.id)}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setNewAdmin((prev) => ({
                            ...prev,
                            allowed_sports: checked
                              ? Array.from(new Set([...(prev.allowed_sports || []), sport.id]))
                              : (prev.allowed_sports || []).filter((id) => id !== sport.id),
                          }));
                        }}
                      />
                      <span>{sport.icon} {sport.name}</span>
                    </label>
                  ))}
                </div>
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', marginTop: '0.5rem' }}>
                  Select one or more sports for this admin. The current admin can only assign sports they already manage.
                </p>
              </div>
              <button className="btn-primary" style={{ width: '100%' }}>Create Admin</button>
            </form>
          </div>

          <div className="card">
            <h2 className="admin-section-title">Current Admins</h2>
            <p className="admin-section-desc">
              {admins.length} admin account{admins.length !== 1 ? 's' : ''} registered.
            </p>
            <div className="table-responsive">
              <table className="leaderboard-table">
                <thead>
                  <tr>
                    <th>Username</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {admins.map(a => (
                    <tr key={a.id}>
                      <td className="team-name-cell">
                        {a.username}
                        {a.username === 'general_admin' && <span style={{ color: 'var(--color-primary)', fontSize: '0.7rem', marginLeft: '0.5rem' }}>[General]</span>}
                        {Array.isArray(a.allowed_sports) && a.allowed_sports.length > 0 && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.2rem' }}>
                            {a.allowed_sports.join(', ')}
                          </div>
                        )}
                      </td>
                      <td>
                        {a.username !== 'general_admin' && (
                          <button 
                            className="btn-outline btn-sm"
                            onClick={() => handleDeleteAdmin(a.id)}
                            style={{ color: '#ff4444', borderColor: '#ff4444' }}
                          >
                            Remove
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminDashboard;
