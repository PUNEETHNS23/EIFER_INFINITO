import React, { useState, useEffect, useCallback } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import api from '../api';
import { SPORTS, getSportCategories } from '../sports/sportsConfig';
import './AdminTournament.css';

// ── Constants ────────────────────────────────────────────────────────────────
const BRACKET_SPORT_IDS = [
  'cricket','volleyball','football','badminton',
  'table-tennis','chess','carrom','tug-of-war','kho-kho', 'arm-wrestling',
];

const CARD_W       = 240;
const CARD_H       = 110;
const CONN_W       = 40;
const ROUND_W      = CARD_W + CONN_W;
const HEADER_H     = 38;
const BASE_SLOT_H  = CARD_H + 20;

function getRoundName(total, idx) {
  const fromEnd = total - 1 - idx;
  if (fromEnd === 0) return 'Final';
  if (fromEnd === 1) return 'Semifinal';
  if (fromEnd === 2) return 'Quarterfinal';
  if (fromEnd === 3) return 'Round of 16';
  if (fromEnd === 4) return 'Round of 32';
  
  // If this is the very first round and there are Byes in the system, 
  // it's effectively a Play-in round.
  if (idx === 0) return 'Round 1 (Play-in)';
  
  return `Round ${idx + 1}`;
}

function fmtTime(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return `${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

// ── ConfirmationModal ────────────────────────────────────────────────────────
function ConfirmationModal({ isOpen, title, message, onConfirm, onCancel }) {
  if (!isOpen) return null;
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
      background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(5px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
    }}>
      <div style={{
        background: '#111', border: '1px solid var(--color-primary)', borderRadius: 24,
        padding: '2.5rem', maxWidth: 450, width: '90%', textAlign: 'center',
        boxShadow: '0 20px 50px rgba(0,0,0,0.5)', animation: 'scaleUp 0.3s ease-out'
      }}>
        <div style={{ fontSize: '3rem', marginBottom: '1.5rem' }}>⚠️</div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 900, marginBottom: '1rem', color: '#fff' }}>{title}</h2>
        <p style={{ color: 'var(--color-text-muted)', marginBottom: '2.5rem', lineHeight: '1.6' }}>{message}</p>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button onClick={onCancel} className="btn-outline" style={{ flex: 1, padding: '1rem' }}>❌ Cancel</button>
          <button onClick={onConfirm} className="btn-primary" style={{ flex: 1, padding: '1rem', boxShadow: '0 0 20px rgba(99,102,241,0.3)' }}>✅ Confirm</button>
        </div>
      </div>
    </div>
  );
}

// ── MatchCard ─────────────────────────────────────────────────────────────────
function MatchCard({ 
  match, sportId, tournamentId, isAdmin, 
  onSetWinner, onDragStart, onDropTeam, draggingRef, onInternalSwap
}) {
  const navigate = useNavigate();
  const [showWinner, setShowWinner] = useState(false);

  const isBye    = (match.teamB === null && match.teamA !== null) || (!match.is_3rd_place && match.round === 1 && match.teamB === null);
  const teamASet = !!match.teamA;
  const teamBSet = !!match.teamB;
  const bothSet  = teamASet && teamBSet;
  const hasWon   = !!match.winner;
  const aWon     = hasWon && match.winner?.id === match.teamA?.id;
  const bWon     = hasWon && match.winner?.id === match.teamB?.id;

  const teamALabel = match.teamA?.name || 'TBD';
  const teamBLabel = isBye ? 'BYE' : (match.teamB?.name || 'TBD');

  const handleDragStart = (e, teamKey) => {
    if (hasWon) { e.preventDefault(); return; }
    onDragStart(match.uid, teamKey);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDrop = (e, targetKey) => {
    e.preventDefault();
    if (hasWon) return;
    if (!draggingRef.current) return;
    onDropTeam(draggingRef.current.matchUid, draggingRef.current.teamKey, match.uid, targetKey);
  };

  const handleDragOver = (e) => {
    if (!hasWon) e.preventDefault();
  };

  const rowStyle = (won, isSet, isByeRow) => ({
    padding: '6px 10px',
    display: 'flex', alignItems: 'center', gap: 6,
    background: won ? 'rgba(52,211,153,0.09)' : 'transparent',
    opacity: isByeRow ? 0.4 : 1,
    minHeight: 34,
    cursor: !hasWon && isSet ? 'grab' : 'default',
    borderBottom: '1px solid rgba(255,255,255,0.06)'
  });

  const nameStyle = (won, isSet) => ({
    flex: 1, fontWeight: won ? 700 : 400,
    fontSize: '0.8rem',
    color: won ? '#34d399' : isSet ? 'var(--color-text)' : 'var(--color-text-muted)',
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
    fontStyle: !isSet ? 'italic' : 'normal',
  });

  return (
    <div style={{
      width: CARD_W,
      border: `1px solid ${hasWon ? 'rgba(52,211,153,0.3)' : bothSet && !hasWon ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.1)'}`,
      borderRadius: 10,
      background: hasWon ? 'rgba(52,211,153,0.05)' : bothSet && !hasWon ? 'rgba(99,102,241,0.05)' : 'rgba(255,255,255,0.03)',
      overflow: 'visible',
      userSelect: 'none',
      transition: 'all 0.2s',
      boxShadow: bothSet && !hasWon ? '0 0 10px rgba(99,102,241,0.1)' : 'none',
      cursor: draggingRef?.current ? 'copy' : 'default'
    }}>
      {/* Header */}
      <div style={{ padding: '5px 10px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: '10px 10px 0 0' }}>
        <span style={{ fontSize: '0.65rem', fontWeight: 700, color: match.is_3rd_place ? '#f59e0b' : 'var(--color-primary)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          {match.is_3rd_place ? '🥉 3rd Place' : match.uid.replace('r', 'R').replace('m', 'M')}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {isAdmin && bothSet && !hasWon && (
            <button 
              onClick={() => onInternalSwap(match.uid)}
              title="Swap Side A / B"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-primary)', fontSize: '0.85rem', padding: '0 4px', opacity: 0.7 }}
            >
              🔄
            </button>
          )}
          {(match.scheduled_at || match.venue) && (
            <span style={{ fontSize: '0.62rem', color: 'var(--color-text-muted)', textAlign: 'right' }}>
              {fmtTime(match.scheduled_at)}
              {match.venue && <><br/>📍 {match.venue}</>}
            </span>
          )}
          {isAdmin && (
            <Link 
              to={`/admin/tournament/${tournamentId}/match/${match.uid}`}
              title="Edit schedule and venue"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', fontSize: '0.8rem', padding: 2, textDecoration: 'none' }}
            >
              ⚙️
            </Link>
          )}
        </div>
      </div>

      {/* Team rows */}
      <div 
        style={rowStyle(aWon, teamASet, false)} 
        draggable={!hasWon && teamASet} 
        onDragStart={(e) => handleDragStart(e, 'teamA')}
        onDrop={(e) => handleDrop(e, 'teamA')}
        onDragOver={handleDragOver}
        className="drag-target"
      >
        {aWon && <span style={{ fontSize: '0.75rem' }}>🏆</span>}
        <span style={nameStyle(aWon, teamASet)}>{teamALabel}</span>
      </div>

      <div 
        style={{ ...rowStyle(bWon, teamBSet, isBye), borderBottom: 'none' }} 
        draggable={!hasWon && teamBSet && !isBye} 
        onDragStart={(e) => handleDragStart(e, 'teamB')}
        onDrop={(e) => handleDrop(e, 'teamB')}
        onDragOver={handleDragOver}
        className="drag-target"
      >
        {bWon && <span style={{ fontSize: '0.75rem' }}>🏆</span>}
        <span style={nameStyle(bWon, teamBSet)}>{teamBLabel}</span>
      </div>

      {/* Admin action bar */}
      {isAdmin && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', padding: '6px 8px', display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center', minHeight: 34 }}>
          {bothSet && !hasWon && !showWinner && (
            <button type="button" onClick={() => setShowWinner(true)}
              style={{ flex: 1, fontSize: '0.68rem', padding: '4px', borderRadius: 6, border: '1px solid var(--color-primary)', background: 'rgba(99,102,241,0.15)', color: 'var(--color-primary)', cursor: 'pointer', fontWeight: 600 }}>
              Set Winner
            </button>
          )}
          {bothSet && !hasWon && showWinner && (
            <>
              {[match.teamA, match.teamB].map(team => (
                <button key={team?.id || Math.random()} type="button"
                  onClick={() => { onSetWinner(match.uid, team); setShowWinner(false); }}
                  style={{ flex: 1, fontSize: '0.65rem', padding: '4px', borderRadius: 5, border: '1px solid #34d399', background: 'rgba(52,211,153,0.15)', color: '#34d399', cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '40%' }}>
                  {team?.name || 'BYE'}
                </button>
              ))}
              <button type="button" onClick={() => setShowWinner(false)}
                style={{ fontSize: '0.75rem', padding: '0 6px', borderRadius: 5, border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: 'var(--color-text-muted)', cursor: 'pointer' }}>✕</button>
            </>
          )}

          {/* Connect to live desk */}
          {match.match_id && !hasWon && (
             <Link to={`/admin/score/${sportId}?match=${match.match_id}`}
             style={{ flex: 1, fontSize: '0.68rem', padding: '4px', borderRadius: 6, border: '1px solid #f59e0b', background: 'rgba(245,158,11,0.15)', color: '#f59e0b', textDecoration: 'none', textAlign: 'center', fontWeight: 600 }}>
             🎯 Score Desk
           </Link>
          )}
          
          {hasWon && (
            <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
               <span style={{ fontSize: '0.7rem', color: '#34d399', fontWeight: 700 }}>✓ Decided</span>
               {match.match_id && (
                 <Link to={`/admin/score/${sportId}?match=${match.match_id}`}
                   style={{ fontSize: '0.65rem', padding: '3px 6px', borderRadius: 5, border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: 'var(--color-text-muted)', textDecoration: 'none' }}>
                   View Logs
                 </Link>
               )}
            </div>
          )}
          {!bothSet && !hasWon && (
            <span style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', fontStyle: 'italic', paddingLeft: 4 }}>Awaiting match-up...</span>
          )}
        </div>
      )}
    </div>
  );
}

// ── BracketVisualization ──────────────────────────────────────────────────────
function BracketVisualization({ rounds, sportId, tournamentId, isAdmin, onSetWinner, onSwapTeams }) {
  const draggingRef = React.useRef(null);

  if (!rounds?.length) return (
    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-muted)' }}>
      <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>📋</div>
      <p style={{ margin: 0 }}>No bracket generated yet.</p>
    </div>
  );

  // Robust height calculation: use the round with the MOST matches
  const maxMatches = Math.max(...rounds.map(r => r.length));
  const totalH     = maxMatches * BASE_SLOT_H;
  const totalW     = rounds.length * ROUND_W + CARD_W + 60;
  
  // slotH is now local to each round to support centering
  const getMatchY = (rIdx, mIdx) => {
    const numMatches = rounds[rIdx].length;
    const sh = totalH / numMatches;
    return HEADER_H + mIdx * sh + (sh - CARD_H) / 2;
  };

  const champion = rounds[rounds.length - 1]?.find(m => !m.is_3rd_place)?.winner;

  const handleDragStart = (matchUid, teamKey) => {
    draggingRef.current = { matchUid, teamKey };
  };

  const handleDropTeam = (srcMatchUid, srcTeamKey, tgtMatchUid, tgtTeamKey) => {
    if (srcMatchUid === tgtMatchUid && srcTeamKey === tgtTeamKey) return;
    onSwapTeams(srcMatchUid, srcTeamKey, tgtMatchUid, tgtTeamKey);
    draggingRef.current = null;
  };

  return (
    <div style={{ overflowX: 'auto', overflowY: 'visible', paddingBottom: '1rem', paddingTop: '0.5rem' }}>
      <div style={{ position: 'relative', width: totalW, height: totalH + HEADER_H + 32 }}>

        {/* Round headers */}
        {rounds.map((_, rIdx) => (
          <div key={`hr${rIdx}`} style={{
            position: 'absolute', left: rIdx * ROUND_W, top: 0, width: CARD_W,
            textAlign: 'center', fontSize: '0.8rem', fontWeight: 800,
            color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.07em',
          }}>
            {getRoundName(rounds.length, rIdx)}
          </div>
        ))}

        {/* Match cards */}
        {rounds.map((round, rIdx) =>
          round.map((match, mIdx) => {
            const x = rIdx * ROUND_W;
            const y = getMatchY(rIdx, mIdx);
            return (
              <div key={match.uid} style={{ position: 'absolute', left: x, top: y, zIndex: 10 }}>
                <MatchCard
                  match={match}
                  sportId={sportId}
                  tournamentId={tournamentId}
                  isAdmin={isAdmin}
                  onSetWinner={onSetWinner}
                  onDragStart={handleDragStart}
                  onDropTeam={handleDropTeam}
                  draggingRef={draggingRef}
                  onInternalSwap={(uid) => onSwapTeams(uid, 'teamA', uid, 'teamB')}
                />
              </div>
            );
          })
        )}

        {/* SVG connector lines using Graph Links */}
        {rounds.map((round, rIdx) => {
          return (
            <svg key={`c${rIdx}`} style={{
              position: 'absolute', left: 0, top: 0,
              width: totalW, height: totalH + HEADER_H, overflow: 'visible', pointerEvents: 'none',
              zIndex: 1
            }}>
              {round.map((match, mIdx) => {
                const nextUid = match.next_match_uid;
                if (!nextUid) return null;

                // Find destination match coords
                let destMatch = null;
                let drIdx = -1;
                let dmIdx = -1;
                for (let r = 0; r < rounds.length; r++) {
                  const idx = rounds[r].findIndex(m => m.uid === nextUid);
                  if (idx !== -1) {
                    destMatch = rounds[r][idx];
                    drIdx = r;
                    dmIdx = idx;
                    break;
                  }
                }
                if (!destMatch) return null;

                const x1 = rIdx * ROUND_W + CARD_W;
                const y1 = getMatchY(rIdx, mIdx) + CARD_H / 2;
                const x2 = drIdx * ROUND_W;
                const y2 = getMatchY(drIdx, dmIdx) + (match.next_match_slot === 'teamA' ? CARD_H * 0.25 : CARD_H * 0.75);

                const cx = x1 + (x2 - x1) / 2;
                const col = 'rgba(99,102,241,0.25)';

                return (
                  <g key={`l-${match.uid}`}>
                    <path 
                      d={`M ${x1} ${y1} L ${cx} ${y1} L ${cx} ${y2} L ${x2} ${y2}`}
                      fill="none" 
                      stroke={col} 
                      strokeWidth="2" 
                    />
                  </g>
                );
              })}
            </svg>
          );
        })}

        {/* Champion badge */}
        {champion && (
          <div style={{
            position: 'absolute', left: rounds.length * ROUND_W + 16,
            top: HEADER_H + (totalH - 110) / 2, width: 140, zIndex: 10
          }}>
            <div style={{
              background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#000',
              padding: '1.2rem 0.8rem', borderRadius: 16, textAlign: 'center',
              fontWeight: 800, boxShadow: '0 8px 30px rgba(245,158,11,0.6)',
            }}>
              <div style={{ fontSize: '2rem' }}>🏆</div>
              <div style={{ fontSize: '0.65rem', letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 5 }}>Champion</div>
              <div style={{ fontSize: '1rem', marginTop: 4, lineHeight: 1.2 }}>{champion.name}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function AdminTournament() {
  const { user, authLoading } = useAuth();
  const { sportId } = useParams();
  const [tournaments,  setTournaments]  = useState([]);
  const [selectedId,   setSelectedId]   = useState(null);
  const [tournament,   setTournament]   = useState(null);
  const [loadingList,  setLoadingList]  = useState(true);

  // Form
  const [form, setForm] = useState({ sport_id: sportId || 'cricket', name: '', category: '', venue: '' });
  const [sportTeams,      setSportTeams]      = useState([]);
  const [selectedTeamIds, setSelectedTeamIds] = useState([]);
  const [creating,        setCreating]        = useState(false);

  const fetchList = useCallback(async () => {
    setLoadingList(true);
    try {
      const res = await api.get('/tournaments');
      setTournaments(res.data);
    } catch (e) { console.error(e); }
    finally { setLoadingList(false); }
  }, []);

  const fetchOne = useCallback(async (id) => {
    try {
      const res = await api.get(`/tournaments/${id}`);
      setTournament(res.data);
    } catch (e) { console.error(e); }
  }, []);

  const loadSportTeams = useCallback(async (sportId) => {
    try {
      const res = await api.get(`/teams/sport/${sportId}`);
      setSportTeams(res.data || []);
    } catch { setSportTeams([]); }
  }, []);

  useEffect(() => { if (user) fetchList(); }, [user, fetchList]);
  
  useEffect(() => {
    if (sportId) {
      setForm(f => ({ ...f, sport_id: sportId, category: '' }));
      setSelectedTeamIds([]);
    }
  }, [sportId]);

  useEffect(() => { if (form.sport_id) loadSportTeams(form.sport_id); }, [form.sport_id, loadSportTeams]);

  const selectTournament = (id) => {
    setSelectedId(id);
    setTournament(null);
    fetchOne(id);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (selectedTeamIds.length < 2) { alert('Select at least 2 teams.'); return; }
    if (!window.confirm(`Generate tournament logic will automatically distribute ${selectedTeamIds.length} teams and assign BYEs if necessary. Continue?`)) return;

    setCreating(true);
    try {
      const res = await api.post('/tournaments', {
        sport_id: form.sport_id,
        name:     form.name,
        category: form.category || null,
        venue:    form.venue || null,
        team_ids: selectedTeamIds,
      });
      await fetchList();
      selectTournament(res.data.id);
      setForm(f => ({ ...f, name: '', category: '', venue: '' }));
      setSelectedTeamIds([]);
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to create tournament');
    } finally { setCreating(false); }
  };

  const handleSetWinner = async (matchUid, team) => {
    if (!tournament) return;
    try {
      const res = await api.post(`/tournaments/${tournament.id}/set-winner`, {
        match_uid:   matchUid,
        winner_id:   team.id,
        winner_name: team.name,
      });
      setTournament(res.data);
      setTournaments(prev => prev.map(t => t.id === res.data.id ? { ...t, status: res.data.status } : t));
    } catch (err) { alert(err.response?.data?.detail || 'Failed to set winner'); }
  };

  const [pendingSwap, setPendingSwap] = useState(null);

  const handleSwapTeams = (srcUid, srcKey, tgtUid, tgtKey) => {
    setPendingSwap({ srcUid, srcKey, tgtUid, tgtKey });
  };

  const confirmSwap = async () => {
    if (!tournament || !pendingSwap) return;
    const { srcUid, srcKey, tgtUid, tgtKey } = pendingSwap;
    try {
      const res = await api.post(`/tournaments/${tournament.id}/swap-teams`, {
        match_uid_src: srcUid,
        team_key_src: srcKey,
        match_uid_tgt: tgtUid,
        team_key_tgt: tgtKey,
      });
      setTournament(res.data);
    } catch (err) { alert(err.response?.data?.detail || 'Failed to swap teams'); }
    finally { setPendingSwap(null); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this tournament and all its generated DB matches?')) return;
    try {
      await api.delete(`/tournaments/${id}`);
      await fetchList();
      if (selectedId === id) { setSelectedId(null); setTournament(null); }
    } catch (err) { alert(err.response?.data?.detail || 'Failed to delete'); }
  };

  const toggleTeam = (id) => setSelectedTeamIds(prev =>
    prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
  );
  
  const handleSelectAll = (filtered) => {
    const allIds = filtered.map(t => t.id);
    const hasAll = allIds.every(id => selectedTeamIds.includes(id));
    if (hasAll) {
      setSelectedTeamIds(prev => prev.filter(id => !allIds.includes(id)));
    } else {
      setSelectedTeamIds(prev => Array.from(new Set([...prev, ...allIds])));
    }
  };

  const categories    = getSportCategories(form.sport_id);
  const filteredTeams = form.category
    ? sportTeams.filter(t => (t.category || '') === form.category)
    : sportTeams;

  if (authLoading) return null;
  if (!user)       return <Navigate to="/login" />;

  const bracketSports = SPORTS.filter(s => BRACKET_SPORT_IDS.includes(s.id));

  return (
    <div className="container" style={{ paddingTop: '2rem', paddingBottom: '5rem' }}>
      
      {/* ── HEADER ───────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
        <Link to="/admin" className="btn-outline btn-sm">← Admin</Link>
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>
            {sportId ? `${SPORTS.find(s => s.id === sportId)?.icon || '🏆'} ${SPORTS.find(s => s.id === sportId)?.name || 'Events'}` : '🏆 Events & Scheduling'}
          </h1>
          <p style={{ color: 'var(--color-text-muted)', margin: '0.25rem 0 0', fontSize: '0.87rem' }}>
            Automated tournament brackets and match coordination.
          </p>
        </div>
      </div>

      {/* ── DASHBOARD VIEW (No Tournament Selected) ───────────────────────── */}
      {!selectedId ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem', alignItems: 'start' }}>
          
          {/* Create Form */}
          <div className="card">
            <h3 style={{ margin: '0 0 1.5rem', fontSize: '1.2rem', fontWeight: 900, color: 'var(--color-primary)' }}>
              + Create New Tournament
            </h3>
            <form onSubmit={handleCreate}>
              {!sportId ? (
                <div className="input-group">
                  <label className="input-label">Sport</label>
                  <select className="input-field" value={form.sport_id}
                    onChange={e => { setForm(f => ({ ...f, sport_id: e.target.value, category: '' })); setSelectedTeamIds([]); }}>
                    {bracketSports.map(s => (
                      <option key={s.id} value={s.id}>{s.icon} {s.name}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-primary)', fontWeight: 700 }}>
                  Locked to: {SPORTS.find(s => s.id === sportId)?.icon} {SPORTS.find(s => s.id === sportId)?.name}
                </div>
              )}

              <div className="input-group">
                <label className="input-label">Tournament Name</label>
                <input type="text" className="input-field" required value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Annual Championship" />
              </div>

              {categories.length > 0 && (
                <div className="input-group">
                  <label className="input-label">Category</label>
                  <select className="input-field" value={form.category}
                    onChange={e => { setForm(f => ({ ...f, category: e.target.value })); setSelectedTeamIds([]); }}>
                    <option value="">All</option>
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              )}

              <div className="input-group">
                <label className="input-label">Venue / Stadium</label>
                <input
                  type="text"
                  className="input-field"
                  value={form.venue}
                  onChange={e => setForm(f => ({ ...f, venue: e.target.value }))}
                  placeholder="e.g. Main Stadium, Court 2"
                />
              </div>

              <div className="input-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 6 }}>
                  <label className="input-label" style={{ marginBottom: 0 }}>
                    Select Teams ({selectedTeamIds.length})
                  </label>
                  {filteredTeams.length > 0 && (
                    <button type="button" onClick={() => handleSelectAll(filteredTeams)} style={{ background: 'none', border: 'none', color: 'var(--color-primary)', fontSize: '0.75rem', cursor: 'pointer', padding: 0 }}>
                      Toggle All
                    </button>
                  )}
                </div>
                <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, background: 'rgba(0,0,0,0.2)' }}>
                  {filteredTeams.length === 0 ? (
                    <p style={{ padding: '1rem', fontSize: '0.85rem', color: 'var(--color-text-muted)', textAlign: 'center' }}>No teams matches this selection.</p>
                  ) : filteredTeams.map(t => (
                    <label key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0.6rem 0.8rem', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.85rem' }}>
                      <input type="checkbox" checked={selectedTeamIds.includes(t.id)} onChange={() => toggleTeam(t.id)} />
                      <span style={{ flex: 1 }}>{t.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <button type="submit" className="btn-primary" style={{ width: '100%', padding: '0.8rem', marginTop: '1.5rem' }} disabled={creating || selectedTeamIds.length < 2}>
                {creating ? 'Generating Brackets…' : `⚡ Generate Bracket`}
              </button>
            </form>
          </div>

          {/* Recent List */}
          <div className="card">
            <h3 style={{ margin: '0 0 1.5rem', fontSize: '1.2rem', fontWeight: 900 }}>
              Existing Events
            </h3>
            {(() => {
              const list = sportId 
                ? tournaments.filter(t => String(t.sport_id || '').toLowerCase() === sportId.toLowerCase()) 
                : tournaments;
              if (list.length === 0) {
                return (
                  <div style={{ textAlign: 'center', padding: '2rem', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: 12, color: 'var(--color-text-muted)' }}>
                    No active brackets found for this sport.
                  </div>
                );
              }
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {list.sort((a, b) => b.id - a.id).map(t => {
                    const sp = SPORTS.find(s => s.id === t.sport_id);
                    return (
                      <div key={t.id} style={{
                        padding: '1.25rem', borderRadius: 16, cursor: 'pointer',
                        border: '1px solid rgba(255,255,255,0.06)',
                        background: 'rgba(255,255,255,0.03)',
                        transition: 'all 0.2s',
                      }} onClick={() => selectTournament(t.id)}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                          <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>{sp?.icon} {t.name}</div>
                          <button type="button" onClick={e => { e.stopPropagation(); handleDelete(t.id); }}
                            style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 0, opacity: 0.6 }}>🗑️</button>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                            {!sportId && <span style={{ textTransform: 'capitalize' }}>{t.sport_id}</span>}
                            {t.category && <span>{!sportId ? '· ' : ''}{t.category}</span>}
                          </div>
                          <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: 'rgba(99,102,241,0.1)', color: 'var(--color-primary)' }}>Manage →</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </div>
      ) : (
        /* ── MANAGEMENT VIEW (Tournament Selected) ───────────────────────── */
        <div>
          {!tournament ? (
            <div style={{ textAlign: 'center', padding: '5rem', color: 'var(--color-text-muted)' }}>Loading tournament engine…</div>
          ) : (
            <>
              {/* Back & Breadcrumbs */}
              <div style={{ marginBottom: '1.5rem' }}>
                <button onClick={() => setSelectedId(null)} className="btn-outline btn-sm">← Back to Dashboard</button>
              </div>

              {/* Tournament Meta Card */}
              <div style={{
                background: 'linear-gradient(135deg, rgba(99,102,241,0.1) 0%, rgba(245,158,11,0.05) 100%)',
                border: '1px solid rgba(99,102,241,0.2)',
                borderRadius: 20, padding: '1.5rem 2rem', marginBottom: '2rem',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem',
              }}>
                <div>
                  <h2 style={{ margin: '0 0 0.25rem', fontSize: '1.8rem', fontWeight: 900 }}>
                    {SPORTS.find(s => s.id === tournament.sport_id)?.icon} {tournament.name}
                  </h2>
                  <div style={{ display: 'flex', gap: '1rem', fontSize: '0.87rem', color: 'var(--color-text-muted)', alignItems: 'center' }}>
                    <span style={{ textTransform: 'capitalize', fontWeight: 700, color: '#fff' }}>{tournament.sport_id}</span>
                    {tournament.category && <span>· {tournament.category}</span>}
                    <span style={{
                      fontSize: '0.75rem', fontWeight: 800, padding: '2px 12px', borderRadius: 999,
                      background: tournament.status === 'completed' ? 'rgba(52,211,153,0.15)' : 'rgba(245,158,11,0.15)',
                      color: tournament.status === 'completed' ? '#34d399' : '#f59e0b',
                    }}>
                      {tournament.status === 'completed' ? '🏆 Completed' : '⚡ Active'}
                    </span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                  <Link 
                    to={`/admin/tournament/${tournament.id}/schedule`} 
                    className="btn-primary"
                    style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.2rem' }}
                  >
                    📅 Schedule Matches
                  </Link>
                  <Link to={`/tournament/${tournament.id}`} target="_blank" className="btn-outline btn-sm" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
                     Public Bracket ↗
                  </Link>
                </div>
              </div>

              {/* Bracket Visualization */}
              <div className="card" style={{ padding: '1.5rem', overflowX: 'auto', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ marginBottom: '2rem' }}>
                  <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.2rem', fontWeight: 800 }}> Bracket Management</h3>
                  <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', fontSize: '0.85rem' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-text-muted)' }}>
                      <span style={{ fontSize: '1rem' }}>🖱️</span> Drag teams to swap upcoming matchups
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-text-muted)' }}>
                      <span style={{ fontSize: '1rem' }}>⚙️</span> Set match times & venues
                    </span>
                  </div>
                </div>

                <BracketVisualization
                  rounds={tournament.bracket || []}
                  sportId={tournament.sport_id}
                  tournamentId={tournament.id}
                  isAdmin={true}
                  onSetWinner={handleSetWinner}
                  onSwapTeams={handleSwapTeams}
                />
              </div>
            </>
          )}
        </div>
      )}

      {/* Swap Confirmation Modal */}
      <ConfirmationModal
        isOpen={!!pendingSwap}
        title="Confirm Team Switch"
        message="Are you sure you want to switch these teams? This action may affect match progression if winners were already predicted downstream."
        onConfirm={confirmSwap}
        onCancel={() => setPendingSwap(null)}
      />
    </div>
  );
}
