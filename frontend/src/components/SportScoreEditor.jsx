import React, { useEffect, useState, useRef, useCallback } from 'react';
import api from '../api';
import { hydrateScoreDetail } from '../sports/sportsConfig';
import LiveCricketScorer from './LiveCricketScorer';
import LiveVolleyballScorer from './LiveVolleyballScorer';
import LiveFootballScorer from './LiveFootballScorer';
import CoinToss from './CoinToss';
import './sportScoreboards.css';

function racketToVolleyballDetail(detail, sid) {
  const d = detail || {};
  const currentSet = Number(d.currentSet || ((d.past_games || []).length + 1) || 1);
  const existingSetTargets = d.setTargets;
  const hasSetTargets =
    existingSetTargets &&
    typeof existingSetTargets === 'object' &&
    !Array.isArray(existingSetTargets) &&
    Object.keys(existingSetTargets).length > 0;
  const setTargets = hasSetTargets ? existingSetTargets : {};
  const setHistory = Array.isArray(d.past_games)
    ? d.past_games.map((g) => ({
        a: Number(g.t1 || 0),
        b: Number(g.t2 || 0),
        winner: Number(g.t1 || 0) >= Number(g.t2 || 0) ? 'A' : 'B',
      }))
    : [];

  const category = d.category || 'Mens Singles';
  const isDoubles = category.includes('Doubles');
  const rosterSize = isDoubles ? 2 : 1;
  const rosterA = isDoubles ? [d.p1_name || '', d.p1_partner || ''] : [d.p1_name || ''];
  const rosterB = isDoubles ? [d.p2_name || '', d.p2_partner || ''] : [d.p2_name || ''];

  const customSets = Number(d.custom_sets || 0);
  const maxSetsFromFormat = d.match_format === 'Best of 5' ? 5 : d.match_format === '1 Game' ? 1 : d.match_format === 'Custom' ? customSets : 3;

  return {
    max_sets: maxSetsFromFormat > 0 ? maxSetsFromFormat : 3,
    sets_t1: Number(d.games_t1 || 0),
    sets_t2: Number(d.games_t2 || 0),
    setsA: Number(d.games_t1 || 0),
    setsB: Number(d.games_t2 || 0),
    pointsA: Number(d.current_p1 || 0),
    pointsB: Number(d.current_p2 || 0),
    currentSet,
    setTargets,
    setHistory,
    servingTeam: d.serving === 't2' ? 'B' : 'A',
    toss_decided: Boolean(d.toss_decided),
    toss_winner: d.toss_winner || '',
    toss_decision: d.toss_decision || '',
    status: d.status || 'upcoming',
    winner: d.winner || null,
    history: d.history || [],
    rosterSize,
    rosterA,
    rosterB,
    category,
    match_format: d.match_format || 'Best of 3',
  };
}

function volleyballPatchToRacket(prevDetail, partial, sid) {
  const next = { ...prevDetail, ...partial };

  if (partial.sets_t1 != null || partial.setsA != null) next.games_t1 = Number(partial.sets_t1 ?? partial.setsA ?? next.games_t1 ?? 0);
  if (partial.sets_t2 != null || partial.setsB != null) next.games_t2 = Number(partial.sets_t2 ?? partial.setsB ?? next.games_t2 ?? 0);
  if (partial.pointsA != null) next.current_p1 = Number(partial.pointsA);
  if (partial.pointsB != null) next.current_p2 = Number(partial.pointsB);
  if (partial.currentSet != null) next.currentSet = Number(partial.currentSet);
  if (partial.setTargets != null) next.setTargets = partial.setTargets;
  if (partial.setHistory != null) {
    next.past_games = partial.setHistory.map((h) => ({ t1: Number(h.a || 0), t2: Number(h.b || 0) }));
  }
  if (partial.servingTeam != null) next.serving = partial.servingTeam === 'B' ? 't2' : 't1';
  if (partial.status != null) next.status = partial.status;
  if (partial.winner != null) next.winner = partial.winner;
  if (partial.history != null) next.history = partial.history;
  if (partial.max_sets != null) {
    const maxSets = Number(partial.max_sets);
    if (maxSets === 5) {
      next.match_format = 'Best of 5';
      next.custom_sets = null;
    } else if (maxSets === 1) {
      next.match_format = '1 Game';
      next.custom_sets = null;
    } else if (maxSets === 3) {
      next.match_format = 'Best of 3';
      next.custom_sets = null;
    } else {
      next.match_format = 'Custom';
      next.custom_sets = Math.max(1, maxSets);
    }
  }

  if (Array.isArray(partial.rosterA) && partial.rosterA.length > 0) {
    next.p1_name = partial.rosterA[0] || next.p1_name || '';
    next.p1_partner = partial.rosterA[1] || '';
  }
  if (Array.isArray(partial.rosterB) && partial.rosterB.length > 0) {
    next.p2_name = partial.rosterB[0] || next.p2_name || '';
    next.p2_partner = partial.rosterB[1] || '';
  }

  if (!next.point_limit) {
    next.point_limit = sid === 'badminton' ? '21' : '11';
  }

  return next;
}

function Num({ label, value, onChange, step = 1 }) {
  return (
    <label className="sbe-field">
      <span>{label}</span>
      <input
        type="number"
        step={step}
        className="input-field"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      />
    </label>
  );
}

function Txt({ label, value, onChange, placeholder = '' }) {
  return (
    <label className="sbe-field">
      <span>{label}</span>
      <input
        type="text"
        className="input-field"
        value={value ?? ''}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function getTugFormat(detail) {
  const raw = detail?.match_format || 'Best of 3';
  if (raw === 'Best of 5' || raw === '1 Game' || raw === 'Best of 3') return raw;
  return 'Custom';
}

function getTugGamesToWin(detail) {
  const format = getTugFormat(detail);
  if (format === 'Best of 5') return 3;
  if (format === '1 Game') return 1;
  return 2;
}

export default function SportScoreEditor({ match, onSaved }) {
  const sid = match.sport_id;
  const [detail, setDetail] = useState(() => hydrateScoreDetail(sid, match));
  const [status, setStatus] = useState(match.status || 'upcoming');
  const [manualStatusOverride, setManualStatusOverride] = useState(false);
  const [team1Data, setTeam1Data] = useState(null);
  const [team2Data, setTeam2Data] = useState(null);
  const [allTeams, setAllTeams] = useState([]);

  useEffect(() => {
    setDetail(hydrateScoreDetail(sid, match));
    setStatus(match.status || 'upcoming');
    setManualStatusOverride(false);
  }, [match.id, sid, match.score_detail, match.status, match.score_t1, match.score_t2]);

  useEffect(() => {
    if (['cricket', 'volleyball', 'badminton', 'table-tennis', 'football'].includes(sid)) {
      api.get(`/teams`).then(res => {
         setTeam1Data(res.data.find(t => String(t.id) === String(match.team1_id)) || null);
         setTeam2Data(res.data.find(t => String(t.id) === String(match.team2_id)) || null);
      });
    }
    if (sid === 'athletics') {
      api.get(`/teams`).then(res => setAllTeams(res.data));
    }
  }, [sid, match.team1_id, match.team2_id]);

  const detailRef = useRef(detail);
  detailRef.current = detail;

  const save = useCallback(async (overrideDetail) => {
    const isEvent = overrideDetail && typeof overrideDetail.preventDefault === 'function';
    const toSave = (!overrideDetail || isEvent) ? detailRef.current : overrideDetail;
    await api.put(`/matches/${match.id}`, { score_detail: toSave, status });
    onSaved?.();
  }, [match.id, status, onSaved]);

  const endMatch = useCallback(async () => {
    setManualStatusOverride(true);
    setStatus('completed');
    await api.put(`/matches/${match.id}`, { score_detail: detailRef.current, status: 'completed' });
    onSaved?.();
  }, [match.id, onSaved]);
 
  const finalizeTournament = async () => {
    if (!window.confirm("🏆 Are you sure you want to finalize the tournament for this sport? \n\nThis will reset the Athletics leaderboard and recalculate points based on all matches marked as 'Final'. This action cannot be easily undone.")) return;
    try {
      await api.post(`/sports/${sid}/finalize`);
      alert("Leaderboard updated successfully!");
      onSaved?.();
    } catch (err) {
      alert("Failed to finalize tournament: " + (err.response?.data?.detail || err.message));
    }
  };

  // For interactive sports: auto-save whenever detail changes (each point)
  const saveTimeoutRef = useRef(null);
  useEffect(() => {
    if (!['cricket', 'volleyball', 'badminton', 'table-tennis', 'football'].includes(sid)) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      api.put(`/matches/${match.id}`, { score_detail: detail, status });
    }, 600); // debounce 600ms
    return () => clearTimeout(saveTimeoutRef.current);
  }, [detail, sid, match.id, status]);

  useEffect(() => {
    if (!['badminton', 'table-tennis', 'tug-of-war', 'cricket', 'volleyball', 'football', 'carrom', 'kho-kho'].includes(sid)) return;
    if (manualStatusOverride) return;

    if (sid === 'tug-of-war') {
      const gamesToWin = getTugGamesToWin(detail);
      const t1Rounds = Number(detail.rounds_t1 || 0);
      const t2Rounds = Number(detail.rounds_t2 || 0);
      const hasWinner = t1Rounds >= gamesToWin || t2Rounds >= gamesToWin;

      if (hasWinner && status !== 'completed') {
        setStatus('completed');
        return;
      }

      if (!hasWinner && status === 'upcoming' && (t1Rounds > 0 || t2Rounds > 0)) {
        setStatus('live');
      }
      return;
    }

    if (detail.toss_decided && status === 'upcoming') {
      setStatus('live');
    }
  }, [sid, detail.match_format, detail.games_t1, detail.games_t2, detail.toss_decided, status, manualStatusOverride]);

  const patch = useCallback((partial) => {
    setDetail((prev) => {
      if (sid === 'badminton' || sid === 'table-tennis') {
        return volleyballPatchToRacket(prev, partial, sid);
      }
      return { ...prev, ...partial };
    });
  }, [sid]);

  const team1 = match.team1 || 'Team 1';
  const team2 = match.team2 || 'Team 2';
  const racketSubcategory = ['badminton', 'table-tennis'].includes(sid)
    ? ((typeof detail?.category === 'string' && detail.category.trim()) ? detail.category.trim() : 'Unspecified')
    : '';

  let form = null;
  switch (sid) {
    case 'football':
      form = <LiveFootballScorer detail={detail} patch={patch} team1={team1} team2={team2} team1Data={team1Data} team2Data={team2Data} matchStatus={status} onEndMatch={endMatch} />;
      break;
    case 'volleyball':
      return (
        <div className="sport-editor-card" data-sport={sid}>
          <div className="sbe-head">
            <h3>{team1} <span className="sbe-vs">vs</span> {team2}</h3>
            <span className="sbe-id">Match #{match.id}</span>
          </div>
          <LiveVolleyballScorer
            key={match.id}
            detail={detail}
            patch={patch}
            team1={team1}
            team2={team2}
            team1Data={team1Data}
            team2Data={team2Data}
            serveIcon="🏐"
            sportId={sid}
          />
          <div className="sbe-status" style={{ marginTop: '1rem' }}>
            <label className="sbe-field">
              <span>Status</span>
              <select className="input-field" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="upcoming">Upcoming</option>
                <option value="live">Live</option>
                <option value="completed">Completed</option>
              </select>
            </label>
          </div>
        </div>
      );
    case 'cricket':
      form = <LiveCricketScorer detail={detail} patch={patch} team1={team1} team2={team2} team1Data={team1Data} team2Data={team2Data} onEndMatch={endMatch} />;
      break;
    case 'carrom':
      form = !detail.toss_decided && status !== 'completed' ? (
        <div className="sbe-toss-box" style={{ padding: '1rem', border: '1px solid var(--color-border)', borderRadius: '8px', background: 'var(--color-bg-surface)', marginBottom: '1rem' }}>
          <CoinToss
            sportId={sid}
            team1Name={team1}
            team2Name={team2}
            onTossComplete={(tossData) => patch({ ...tossData, toss_decided: true })}
          />
        </div>
      ) : (
        <div className="sbe-grid">
          {status !== 'completed' && (
            <>
              <div className="sbe-field">
                <span>Match Type</span>
                <select 
                  className="input-field" 
                  value={detail.match_type || 'individuals'} 
                  onChange={(e) => patch({ match_type: e.target.value })}
                >
                  <option value="individuals">Individuals</option>
                  <option value="teams">Teams (2 players each)</option>
                </select>
              </div>
              <div className="sbe-field">
                <span>{team1} - Strike Coin Color</span>
                <select 
                  className="input-field" 
                  value={detail.color_assignment?.t1 || 'black'} 
                  onChange={(e) => patch({ color_assignment: { ...detail.color_assignment, t1: e.target.value } })}
                >
                  <option value="black">Black</option>
                  <option value="white">White</option>
                </select>
              </div>
              <div className="sbe-field">
                <span>{team2} - Strike Coin Color</span>
                <select 
                  className="input-field" 
                  value={detail.color_assignment?.t2 || 'white'} 
                  onChange={(e) => patch({ color_assignment: { ...detail.color_assignment, t2: e.target.value } })}
                >
                  <option value="black">Black</option>
                  <option value="white">White</option>
                </select>
              </div>
            </>
          )}
          {status === 'completed' ? (
            <>
              <Num label={`${team1} final points`} value={detail.points_t1} onChange={(v) => patch({ points_t1: v })} />
              <Num label={`${team2} final points`} value={detail.points_t2} onChange={(v) => patch({ points_t2: v })} />
            </>
          ) : (
            <div className="sbe-field" style={{ gridColumn: '1 / -1' }}>
              <span>Final score entry</span>
              <p style={{ margin: '0.5rem 0 0', color: 'var(--color-text-muted)' }}>
                Keep this match upcoming or live while it is in progress. Switch it to completed to enter the final scores.
              </p>
            </div>
          )}
        </div>
      );
      break;
    case 'kho-kho':
      form = status === 'completed' ? (
        <div className="sbe-grid">
          <div className="sbe-field" style={{ gridColumn: '1 / -1' }}>
            <span>Winner</span>
            <select className="input-field" value={detail.winner || ''} onChange={(e) => patch({ winner: e.target.value })}>
              <option value="">Select Winner...</option>
              <option value="draw">Draw</option>
              <option value="t1">{team1} wins</option>
              <option value="t2">{team2} wins</option>
            </select>
          </div>
          <Num label="Final Time (Minutes)" value={detail.minutes} onChange={(v) => patch({ minutes: v })} />
          <Num label="Final Time (Seconds)" value={detail.seconds} onChange={(v) => patch({ seconds: v })} />
        </div>
      ) : !detail.toss_decided ? (
        <div className="sbe-toss-box" style={{ padding: '1rem', border: '1px solid var(--color-border)', borderRadius: '8px', background: 'var(--color-bg-surface)', marginBottom: '1rem' }}>
          <CoinToss
            sportId={sid}
            team1Name={team1}
            team2Name={team2}
            onTossComplete={(tossData) => patch({ ...tossData, toss_decided: true })}
          />
        </div>
      ) : (
        <div className="sbe-grid">
          <div className="sbe-field" style={{ gridColumn: '1 / -1' }}>
            <span>Final result entry</span>
            <p style={{ margin: '0.5rem 0 0', color: 'var(--color-text-muted)' }}>
              Toss completed. Keep this match upcoming or live while it is in progress. Switch it to completed to enter the final winner and time.
            </p>
          </div>
        </div>
      );
      break;
    case 'chess':
      form = status === 'completed' ? (
        <div className="sbe-field">
          <span>Final result</span>
          <select className="input-field" value={detail.winner || 'draw'} onChange={(e) => patch({ winner: e.target.value })}>
            <option value="draw">Draw</option>
            <option value="t1">{team1} wins</option>
            <option value="t2">{team2} wins</option>
          </select>
        </div>
      ) : (
        <div className="sbe-field" style={{ gridColumn: '1 / -1' }}>
          <span>Final result entry</span>
          <p style={{ margin: '0.5rem 0 0', color: 'var(--color-text-muted)' }}>
            Keep this match scheduled while it is ongoing. Switch the status to completed to enter the final result.
          </p>
        </div>
      );
      break;
    case 'athletics': {
      const participants = detail.participants || [];
      const qualifierCount = detail.qualifier_count || 1;
      const eventType = detail.event_type || 'event';
      const eventLabels = { boys_100m: 'Boys 100m', girls_100m: 'Girls 100m', relay_4x100: '4 × 100m Relay' };
      const eventLabel = eventLabels[eventType] || eventType;

      // Validation helpers
      const ranks = participants.map(p => p.rank).filter(Boolean);
      const hasDuplicateRanks = ranks.length !== new Set(ranks).size;
      const sortedRanks = [...ranks].sort((a, b) => a - b);
      const hasGapInRanks = sortedRanks.some((r, i) => i > 0 && r !== sortedRanks[i - 1] + 1);
      const qualifiedCount = participants.filter(p => p.qualified).length;
      const overQualified = qualifiedCount > qualifierCount;

      const autoSelectQualifiers = () => {
        const sorted = [...participants].sort((a, b) => {
          if (a.rank && b.rank) return a.rank - b.rank;
          if (a.rank) return -1;
          if (b.rank) return 1;
          if (a.time && b.time) return a.time - b.time;
          return 0;
        });
        const qualifiedIds = new Set(sorted.slice(0, qualifierCount).map(p => p.team_id));
        const next = participants.map(p => ({ ...p, qualified: qualifiedIds.has(p.team_id) }));
        patch({ participants: next });
      };

      form = (
        <div style={{ marginTop: '0.5rem' }}>
          {/* Match Info Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem', padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.04)', borderRadius: '8px' }}>
            <span style={{ fontWeight: 700, fontSize: '1rem' }}>{eventLabel}</span>
            {detail.is_final && (
              <span style={{ fontSize: '0.75rem', fontWeight: 800, background: '#fbbf24', color: '#000', padding: '2px 8px', borderRadius: '4px', letterSpacing: '0.08em' }}>FINAL</span>
            )}
            <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
              {qualifierCount} qualifier{qualifierCount !== 1 ? 's' : ''} from {participants.length} participants
            </span>
          </div>

          {/* Validation alerts */}
          {hasDuplicateRanks && (
            <div style={{ padding: '0.6rem 1rem', background: 'rgba(255,68,68,0.1)', border: '1px solid rgba(255,68,68,0.3)', borderRadius: '6px', color: '#ff6b6b', fontSize: '0.82rem', marginBottom: '0.75rem' }}>
              ⚠️ Duplicate ranks detected. Each participant must have a unique rank.
            </div>
          )}
          {hasGapInRanks && (
            <div style={{ padding: '0.6rem 1rem', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '6px', color: '#f59e0b', fontSize: '0.82rem', marginBottom: '0.75rem' }}>
              ⚠️ Ranks are not continuous (e.g. 1, 3 — missing 2). Please use consecutive ranks.
            </div>
          )}
          {overQualified && (
            <div style={{ padding: '0.6rem 1rem', background: 'rgba(255,68,68,0.1)', border: '1px solid rgba(255,68,68,0.3)', borderRadius: '6px', color: '#ff6b6b', fontSize: '0.82rem', marginBottom: '0.75rem' }}>
              ⚠️ {qualifiedCount} teams marked qualified, but only {qualifierCount} can advance. Uncheck {qualifiedCount - qualifierCount} team(s).
            </div>
          )}

          {/* Auto-qualify button */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.75rem' }}>
            <button
              type="button"
              onClick={autoSelectQualifiers}
              style={{ padding: '0.4rem 1rem', background: 'rgba(52,211,153,0.15)', border: '1px solid rgba(52,211,153,0.4)', borderRadius: '6px', color: '#34d399', fontSize: '0.83rem', cursor: 'pointer', fontWeight: 600 }}
            >
              ⚡ Auto-select Top {qualifierCount} Qualifier{qualifierCount !== 1 ? 's' : ''}
            </button>
          </div>

          {/* Results table */}
          <div style={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.05)' }}>
                  <th style={{ padding: '0.6rem 1rem', textAlign: 'left', fontWeight: 600, color: 'var(--color-text-muted)', fontSize: '0.78rem', textTransform: 'uppercase' }}>Team</th>
                  <th style={{ padding: '0.6rem 0.75rem', textAlign: 'center', fontWeight: 600, color: 'var(--color-text-muted)', fontSize: '0.78rem', textTransform: 'uppercase' }}>Rank</th>
                  <th style={{ padding: '0.6rem 0.75rem', textAlign: 'center', fontWeight: 600, color: 'var(--color-text-muted)', fontSize: '0.78rem', textTransform: 'uppercase' }}>Time (s)</th>
                  <th style={{ padding: '0.6rem 0.75rem', textAlign: 'center', fontWeight: 600, color: 'var(--color-text-muted)', fontSize: '0.78rem', textTransform: 'uppercase' }}>Qualified</th>
                </tr>
              </thead>
              <tbody>
                {participants.map((p, idx) => {
                  const teamName = allTeams.find(t => String(t.id) === String(p.team_id))?.name || `Team ${p.team_id}`;
                  const isDuplicate = p.rank && ranks.filter(r => r === p.rank).length > 1;
                  return (
                    <tr key={p.team_id} style={{ borderTop: '1px solid rgba(255,255,255,0.06)', background: p.qualified ? 'rgba(52,211,153,0.04)' : 'transparent' }}>
                      <td style={{ padding: '0.55rem 1rem' }}>
                        <strong>{teamName}</strong>
                        {p.qualified && <span style={{ marginLeft: '0.5rem', fontSize: '0.72rem', color: '#34d399' }}>✅ Q</span>}
                      </td>
                      <td style={{ padding: '0.55rem 0.75rem', textAlign: 'center' }}>
                        <input
                          type="number"
                          min="1"
                          className="input-field"
                          style={{ width: '60px', padding: '0.25rem 0.4rem', textAlign: 'center', borderColor: isDuplicate ? '#ff6b6b' : undefined }}
                          value={p.rank || ''}
                          onChange={e => {
                            const next = [...participants];
                            next[idx] = { ...next[idx], rank: parseInt(e.target.value) || null };
                            patch({ participants: next });
                          }}
                        />
                      </td>
                      <td style={{ padding: '0.55rem 0.75rem', textAlign: 'center' }}>
                        <input
                          type="number"
                          step="0.001"
                          min="0"
                          className="input-field"
                          style={{ width: '85px', padding: '0.25rem 0.4rem', textAlign: 'center' }}
                          value={p.time || ''}
                          onChange={e => {
                            const next = [...participants];
                            next[idx] = { ...next[idx], time: parseFloat(e.target.value) || null };
                            patch({ participants: next });
                          }}
                        />
                      </td>
                      <td style={{ padding: '0.55rem 0.75rem', textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={!!p.qualified}
                          onChange={e => {
                            const next = [...participants];
                            next[idx] = { ...next[idx], qualified: e.target.checked };
                            patch({ participants: next });
                          }}
                          style={{ width: '17px', height: '17px', cursor: 'pointer' }}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Finalize tournament panel */}
          <div style={{ marginTop: '2rem', padding: '1.25rem', background: 'rgba(251,191,36,0.05)', borderRadius: '12px', border: '1px solid rgba(251,191,36,0.2)' }}>
            <h4 style={{ margin: '0 0 0.5rem', color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>🏁</span> Tournament Completion
            </h4>
            <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '1rem' }}>
              Once all heats and final matches are done, push results to the official leaderboard.
              This distributes 5 / 3 / 1 points to the Top 3 from each <strong>Final</strong> match.
            </p>
            <button
              type="button"
              className="btn-primary"
              onClick={finalizeTournament}
              style={{ background: '#fbbf24', color: '#000', fontWeight: 700 }}
            >
              🏆 Push Final Results to Leaderboard
            </button>
          </div>
        </div>
      );
      break;
    }

    case 'badminton':
    case 'table-tennis': {
      const adaptedDetail = racketToVolleyballDetail(detail, sid);
      const defaultSetTarget = Number(detail.point_limit === 'Custom' ? detail.custom_limit : detail.point_limit) || (sid === 'badminton' ? 21 : 11);
      form = (
        <LiveVolleyballScorer
          key={match.id}
          detail={adaptedDetail}
          patch={patch}
          team1={team1}
          team2={team2}
          team1Data={team1Data}
          team2Data={team2Data}
          serveIcon={sid === 'badminton' ? '🏸' : '🏓'}
          allowSetCountConfig
          initialSetTarget={defaultSetTarget}
          showResetOnComplete={false}
          sportId={sid}
        />
      );
      break;
    }
    case 'arm-wrestling':
      form = (
        <div className="sbe-grid" style={{ gap: '1rem' }}>
          <label className="sbe-field" style={{ gridColumn: '1 / -1' }}>
            <span>Match format</span>
            <select
              className="input-field"
              value={detail.match_format || 'Best of 3'}
              onChange={(e) => patch({ match_format: e.target.value })}
            >
              <option value="Best of 3">Best of 3 Rounds</option>
              <option value="Best of 5">Best of 5 Rounds</option>
              <option value="1 Game">Single Match</option>
            </select>
          </label>
          <Num label={`${team1} rounds won`} value={detail.rounds_t1} onChange={(v) => patch({ rounds_t1: v })} />
          <Num label={`${team2} rounds won`} value={detail.rounds_t2} onChange={(v) => patch({ rounds_t2: v })} />
        </div>
      );
      break;
    case 'tug-of-war':
      form = !detail.toss_decided ? (
        <div className="sbe-toss-box" style={{ padding: '1rem', border: '1px solid var(--color-border)', borderRadius: '8px', background: 'var(--color-bg-surface)', marginBottom: '1rem' }}>
          <CoinToss
            sportId={sid}
            team1Name={team1}
            team2Name={team2}
            onTossComplete={(tossData) => patch({ ...tossData, toss_decided: true })}
          />
        </div>
      ) : (
        <div className="sbe-grid" style={{ gap: '1rem' }}>
          <label className="sbe-field" style={{ gridColumn: '1 / -1' }}>
            <span>Match format</span>
            <select
              className="input-field"
              value={getTugFormat(detail)}
              onChange={(e) => {
                const selected = e.target.value;
                if (selected === 'Custom') {
                  patch({ match_format: 'Custom', custom_rounds: 1 });
                  return;
                }
                patch({ match_format: selected, custom_rounds: null });
              }}
            >
              <option value="Best of 3">Best of 3</option>
              <option value="Best of 5">Best of 5</option>
              <option value="1 Game">Single Game</option>
              <option value="Custom">Custom</option>
            </select>
          </label>

          {getTugFormat(detail) === 'Custom' && (
            <label className="sbe-field" style={{ gridColumn: '1 / -1' }}>
              <span>Custom rounds required to win</span>
              <input
                type="number"
                className="input-field"
                min={1}
                value={detail.custom_rounds ?? 1}
                onChange={(e) => patch({ custom_rounds: Number(e.target.value) || 1 })}
              />
            </label>
          )}

          <Num label={`${team1} rounds won`} value={detail.rounds_t1} onChange={(v) => patch({ rounds_t1: v })} />
          <Num label={`${team2} rounds won`} value={detail.rounds_t2} onChange={(v) => patch({ rounds_t2: v })} />
        </div>
      );
      break;
    case 'esports':
      form = (
        <div className="sbe-grid">
          <Num label={`${team1} maps`} value={detail.maps_t1} onChange={(v) => patch({ maps_t1: v })} />
          <Num label={`${team2} maps`} value={detail.maps_t2} onChange={(v) => patch({ maps_t2: v })} />
        </div>
      );
      break;
    default:
      form = (
        <div className="sbe-grid">
          <Num label={`${team1}`} value={detail.score_t1 ?? 0} onChange={(v) => patch({ score_t1: v })} />
          <Num label={`${team2}`} value={detail.score_t2 ?? 0} onChange={(v) => patch({ score_t2: v })} />
        </div>
      );
  }

  return (
    <div className="sport-editor-card" data-sport={sid}>
      <div className="sbe-head">
        <h3>
          {sid === 'athletics'
            ? (() => {
                const evLabels = { boys_100m: 'Boys 100m', girls_100m: 'Girls 100m', relay_4x100: '4 × 100m Relay' };
                return evLabels[detail.event_type] || detail.event_type || 'Athletics Match';
              })()
            : `${team1} vs ${team2}`
          }
        </h3>
        <div className="sbe-head-meta">
          <span className="sbe-id">Match #{match.id}</span>
          {racketSubcategory && <span className="sbe-subcategory">{racketSubcategory}</span>}
        </div>
      </div>
      {form}
      <div className="sbe-status">
        <label className="sbe-field">
          <span>Status</span>
          <select
            className="input-field"
            value={status}
            onChange={(e) => {
              setManualStatusOverride(true);
              setStatus(e.target.value);
            }}
          >
            <option value="upcoming">Upcoming</option>
            {sid !== 'athletics' && <option value="live">Live</option>}
            <option value="completed">Completed</option>
          </select>
        </label>
      </div>
      {sid !== 'cricket' && sid !== 'volleyball' && sid !== 'football' && sid !== 'badminton' && sid !== 'table-tennis' && (
        <button type="button" className="btn-primary sbe-save" onClick={save}>
          Save score
        </button>
      )}
    </div>
  );
}
