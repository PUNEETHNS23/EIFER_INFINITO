import React, { useState, useEffect, useRef } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import api from '../api';
import { SPORTS, CATEGORY_SPORTS, getSportCategories } from '../sports/sportsConfig';
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

  // Form states
  const footballSquadLimit = 11;
  const createTeamState = (sportId = 'athletics') => ({
    name: '',
    sport_id: sportId,
    squad: [],
  });

  const [newTeam, setNewTeam] = useState(createTeamState());
  const [tempPlayerName, setTempPlayerName] = useState('');
  const [newMatch, setNewMatch] = useState({ sport_id: 'athletics', team1_id: '', team2_id: '', scheduled_time: '' });
  const [newAdmin, setNewAdmin] = useState({ username: '', password: '' });
  const [adminMsg, setAdminMsg] = useState('');
  const [dqReason, setDqReason] = useState({});
  const teamsRefreshTimeoutRef = useRef(null);

  const sportsEnum = ['athletics', 'cricket', 'volleyball', 'football', 'carrom', 'chess', 'arm-wrestling', 'weight-lifting', 'kho-kho', 'badminton', 'table-tennis', 'tug-of-war', 'esports'];
  const squadSports = ['cricket', 'volleyball', 'football', 'badminton', 'table-tennis', 'kho-kho', 'chess', 'weight-lifting', 'carrom', 'athletics'];
  const allowSubstituteSports = ['volleyball', 'kho-kho', 'cricket'];
  const racketSports = ['badminton', 'table-tennis', 'carrom'];
  const categorizedSports = Object.keys(CATEGORY_SPORTS);
  
  const getRacketCategoryPlayerLimit = (category) => (category || '').includes('Doubles') ? 2 : 1;
  const getChessCategoryPlayerLimit = (category) => category === 'Rapid' ? 4 : (category === 'Hand & Brain' ? 2 : 1);
  const getAthleticsCategoryPlayerLimit = (category) => (category || '').includes('4 X 100') ? 4 : 1;

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

    if (newTeam.sport_id === 'kho-kho') {
      const players = (newTeam.squad || []).filter(p => !p.is_substitute);
      const subs = (newTeam.squad || []).filter(p => p.is_substitute);
      if (players.length !== 9) {
        alert(`A kho-kho team must have exactly 9 main players. Currently you have ${players.length}.`);
        return;
      }
      if (subs.length !== 3) {
        alert(`A kho-kho team must have exactly 3 substitutes. Currently you have ${subs.length}.`);
        return;
      }
    }

    if (newTeam.sport_id === 'cricket') {
      const players = (newTeam.squad || []).filter(p => !p.is_substitute);
      const subs = (newTeam.squad || []).filter(p => p.is_substitute);
      if (players.length !== 11) {
        alert(`A cricket team must have exactly 11 main players. Currently you have ${players.length}.`);
        return;
      }
      if (subs.length > 3) {
        alert(`A cricket team can have a maximum of 3 substitutes. Currently you have ${subs.length}.`);
        return;
      }
    }

    if (newTeam.sport_id === 'football') {
      const players = (newTeam.squad || []).map((p) => (p.name || '').trim());
      if (players.length > footballSquadLimit) {
        alert(`A football team can have at most ${footballSquadLimit} players.`);
        return;
      }
      if (players.some((name) => !name)) {
        alert('Football player names cannot be empty.');
        return;
      }
      if (new Set(players).size !== players.length) {
        alert('Football player names must be unique.');
        return;
      }
    }

    if (racketSports.includes(newTeam.sport_id)) {
      const players = (newTeam.squad || []).map((p) => (p.name || '').trim()).filter(Boolean);
      const limit = getRacketCategoryPlayerLimit(newTeam.category);
      if (players.length !== limit) {
        const sportName = newTeam.sport_id === 'badminton' ? 'Badminton' : newTeam.sport_id === 'table-tennis' ? 'Table Tennis' : 'Carrom';
        alert(`${sportName} ${newTeam.category || 'category'} requires exactly ${limit} player${limit > 1 ? 's' : ''} per team. Currently you have ${players.length}.`);
        return;
      }
      if (new Set(players).size !== players.length) {
        alert('Player names must be unique within the team squad.');
        return;
      }
    }

    if (newTeam.sport_id === 'athletics') {
      const players = (newTeam.squad || []).filter(p => !p.is_substitute).map((p) => (p.name || '').trim()).filter(Boolean);
      const limit = getAthleticsCategoryPlayerLimit(newTeam.category);
      if (players.length !== limit) {
        alert(`Athletics ${newTeam.category || 'category'} requires exactly ${limit} player${limit > 1 ? 's' : ''} per team. Currently you have ${players.length}.`);
        return;
      }
      if (new Set(players).size !== players.length) {
        alert('Player names must be unique within the team squad.');
        return;
      }
    }

    if (newTeam.sport_id === 'chess') {
      const players = (newTeam.squad || []).filter(p => !p.is_substitute).map((p) => (p.name || '').trim()).filter(Boolean);
      const limit = getChessCategoryPlayerLimit(newTeam.category);
      if (players.length !== limit) {
        alert(`Chess ${newTeam.category || 'category'} requires exactly ${limit} player${limit > 1 ? 's' : ''} per team. Currently you have ${players.length}.`);
        return;
      }
      if (new Set(players).size !== players.length) {
        alert('Player names must be unique within the team squad.');
        return;
      }
    }

    if (newTeam.sport_id === 'weight-lifting') {
      const players = (newTeam.squad || []).filter(p => !p.is_substitute).map((p) => (p.name || '').trim()).filter(Boolean);
      if (players.length !== 1) {
        alert(`Weight-lifting requires exactly 1 player per team. Currently you have ${players.length}.`);
        return;
      }
    }

    try {
      await api.post('/teams', {
        name: newTeam.name,
        sport_id: newTeam.sport_id,
        category: newTeam.category || null,
        squad: newTeam.squad,
      });
      fetchTeams();
      setNewTeam(createTeamState());
    } catch (e) {
      alert('Error adding team');
    }
  };

  const addPlayerToSquad = (isSubstitute = false) => {
    if (tempPlayerName.trim()) {
      if (racketSports.includes(newTeam.sport_id)) {
        const limit = getRacketCategoryPlayerLimit(newTeam.category);
        const currentCount = (newTeam.squad || []).length;
        if (currentCount >= limit) {
          alert(`Maximum ${limit} player${limit > 1 ? 's' : ''} allowed for ${newTeam.category || 'this category'}. Remove a player to add another.`);
          return;
        }
      }

      if (newTeam.sport_id === 'chess') {
        const limit = getChessCategoryPlayerLimit(newTeam.category);
        const currentCount = (newTeam.squad || []).length;
        if (currentCount >= limit) {
          alert(`Maximum ${limit} player${limit > 1 ? 's' : ''} allowed for Chess - ${newTeam.category || 'this category'}. Remove a player to add another.`);
          return;
        }
      }

      if (newTeam.sport_id === 'weight-lifting') {
        const currentCount = (newTeam.squad || []).length;
        if (currentCount >= 1) {
          alert(`Maximum 1 player allowed for Weight-lifting. Remove a player to add another.`);
          return;
        }
      }

      if (newTeam.sport_id === 'football') {
        const currentCount = (newTeam.squad || []).length;
        if (currentCount >= footballSquadLimit) {
          alert(`Maximum ${footballSquadLimit} players allowed for Football. Remove a player to add another.`);
          return;
        }
      }

      if (newTeam.sport_id === 'athletics') {
        const limit = getAthleticsCategoryPlayerLimit(newTeam.category);
        const currentCount = (newTeam.squad || []).length;
        if (currentCount >= limit) {
          alert(`Maximum ${limit} player${limit > 1 ? 's' : ''} allowed for Athletics - ${newTeam.category || 'this category'}. Remove a player to add another.`);
          return;
        }
      }

      const withSubstituteFlag = allowSubstituteSports.includes(newTeam.sport_id) ? isSubstitute : false;
      setNewTeam(prev => ({ ...prev, squad: [...(prev.squad || []), { name: tempPlayerName, is_substitute: withSubstituteFlag }] }));
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

  const thStyle = { padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 600, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)' };
  const tdStyle = { padding: '0.65rem 1rem', verticalAlign: 'middle' };

  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title">Admin Command Center</h1>
      </div>

      {/* Section Tabs */}
      <div className="admin-tabs-container">
        {['matches', 'teams', 'admins'].map(section => (
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
              {SPORTS.map((s) => (
                <Link key={s.id} to={`/admin/score/${s.id}`} className="btn-outline btn-sm" style={{ textAlign: 'center' }}>
                  {s.icon} {s.name}
                </Link>
              ))}
            </div>
          </div>

          <div className="card" style={{ marginBottom: '2rem' }}>
            <h2 className="admin-section-title">Automatic match scheduling</h2>
            <p className="admin-section-desc">
              Create bulk randomized matches for any sport. Team compositions are auto-generated from squads (for applicable sports) and fully editable before saving.
            </p>
            <div className="admin-grid-desks">
              {SPORTS.filter(s => s.id !== 'weight-lifting').map((s) => (
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
          <div className="admin-form-two-col">
            <div className="card">
              <h2 className="admin-section-title">Add New Team & Roster</h2>
              <form onSubmit={handleAddTeam} style={{ marginTop: '1rem' }}>
                <div className="input-group">
                  <label className="input-label">Sport</label>
                  <select
                    className="input-field"
                    value={newTeam.sport_id}
                    onChange={e => {
                      const sportId = e.target.value;
                      setNewTeam((prev) => ({
                        ...prev,
                        sport_id: sportId,
                        category: categorizedSports.includes(sportId) ? getSportCategories(sportId)[0] : '',
                        squad: [],
                      }));
                      setTempPlayerName('');
                    }}
                  >
                    {sportsEnum.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                
                {!squadSports.includes(newTeam.sport_id) ? (
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

                    {categorizedSports.includes(newTeam.sport_id) && (
                      <div className="input-group">
                        <label className="input-label">Subcategory</label>
                        <select
                          className="input-field"
                          value={newTeam.category || getSportCategories(newTeam.sport_id)[0] || ''}
                          onChange={(e) => {
                            const nextCategory = e.target.value;
                            setNewTeam((prev) => {
                              const update = { ...prev, category: nextCategory };
                              if (racketSports.includes(prev.sport_id)) {
                                update.squad = (prev.squad || []).slice(0, getRacketCategoryPlayerLimit(nextCategory));
                              } else if (prev.sport_id === 'chess') {
                                update.squad = (prev.squad || []).slice(0, getChessCategoryPlayerLimit(nextCategory));
                              } else if (prev.sport_id === 'weight-lifting') {
                                update.squad = (prev.squad || []).slice(0, 1);
                              }
                              return update;
                            });
                          }}
                        >
                          {getSportCategories(newTeam.sport_id).map((cat) => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    
                    {(() => {
                      const squad = newTeam.squad || [];
                      const mainCount = squad.filter(p => !p.is_substitute).length;
                      const subCount = squad.filter(p => p.is_substitute).length;
                      
                      let canAddMain = true;
                      let canAddSub = allowSubstituteSports.includes(newTeam.sport_id);

                      if (newTeam.sport_id === 'football') {
                        canAddMain = mainCount < footballSquadLimit;
                        canAddSub = false;
                      } else if (newTeam.sport_id === 'cricket') {
                        canAddMain = mainCount < 11;
                        canAddSub = subCount < 3;
                      } else if (newTeam.sport_id === 'volleyball') {
                        canAddMain = mainCount < 6;
                        canAddSub = subCount < 3;
                      } else if (newTeam.sport_id === 'kho-kho') {
                        canAddMain = mainCount < 9;
                        canAddSub = subCount < 3;
                      } else if (newTeam.sport_id === 'weight-lifting') {
                        canAddMain = mainCount < 1;
                        canAddSub = false;
                      } else if (newTeam.sport_id === 'chess') {
                        canAddMain = mainCount < getChessCategoryPlayerLimit(newTeam.category);
                        canAddSub = false;
                      } else if (racketSports.includes(newTeam.sport_id)) {
                        canAddMain = mainCount < getRacketCategoryPlayerLimit(newTeam.category);
                        canAddSub = false;
                      } else if (newTeam.sport_id === 'athletics') {
                        canAddMain = mainCount < getAthleticsCategoryPlayerLimit(newTeam.category);
                        canAddSub = false;
                      }

                      return (
                        <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', marginBottom: '1.5rem', border: '1px solid rgba(255,255,255,0.1)' }}>
                          <h4 className="admin-section-title" style={{ fontSize: '1.1rem' }}>
                            Team Squad ({newTeam.squad?.length || 0})
                          </h4>
                          {newTeam.sport_id === 'football' && (
                            <p style={{ margin: '0.25rem 0 0.6rem', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                              Football allows up to {footballSquadLimit} players.
                            </p>
                          )}
                          {(racketSports.includes(newTeam.sport_id) || newTeam.sport_id === 'athletics') && (
                            <p style={{ margin: '0.25rem 0 0.6rem', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                              {newTeam.category} requires exactly {newTeam.sport_id === 'athletics' ? getAthleticsCategoryPlayerLimit(newTeam.category) : getRacketCategoryPlayerLimit(newTeam.category)} players.
                            </p>
                          )}
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
                  </>
                )}

                <button className="btn-primary" style={{ width: '100%' }}>Register Team</button>
              </form>
            </div>
          </div>

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
                  <option value="">All</option>
                  {sportsEnum.map((s) => (
                    <option key={s} value={s}>{s}</option>
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
                        {a.username === 'admin' && <span style={{ color: 'var(--color-primary)', fontSize: '0.7rem', marginLeft: '0.5rem' }}>[Root]</span>}
                      </td>
                      <td>
                        {a.username !== 'admin' && (
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
