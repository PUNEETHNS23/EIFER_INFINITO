import { useReducer, useEffect, useRef, useCallback, useState } from 'react';
import CoinToss from './CoinToss';
import './LiveVolleyballScorer.css';

/* ═══════════════════════════════════════════════════════════
   GAME LOGIC (pure reducer — no server needed for scoring)
═══════════════════════════════════════════════════════════ */

function checkSetWin(state) {
  const { pointsA, pointsB, currentSet, setTargets, maxSets } = state;
  const tgt = setTargets[currentSet];
  if (!tgt) return state;

  const aWon  = pointsA >= tgt && pointsA - pointsB >= 2;
  const bWon  = pointsB >= tgt && pointsB - pointsA >= 2;
  if (!aWon && !bWon) return state;

  const winner = aWon ? 'A' : 'B';
  const newHistory = [...state.setHistory, { a: pointsA, b: pointsB, winner }];
  const newSets_t1 = state.sets_t1 + (winner === 'A' ? 1 : 0);
  const newSets_t2 = state.sets_t2 + (winner === 'B' ? 1 : 0);

  const setsToWin = Math.ceil(maxSets / 2);

  if (newSets_t1 >= setsToWin || newSets_t2 >= setsToWin) {
    return {
      ...state,
      sets_t1: newSets_t1, sets_t2: newSets_t2,
      setHistory: newHistory,
      status: 'live',
      winner: newSets_t1 >= setsToWin ? 'A' : 'B',
      pendingComplete: true,
      lastEvent: winner === 'A' ? 'match-a' : 'match-b',
    };
  }

  return {
    ...state,
    sets_t1: newSets_t1, sets_t2: newSets_t2,
    pointsA: 0, pointsB: 0,
    currentSet: state.currentSet + 1,
    setHistory: newHistory,
    lastEvent: winner === 'A' ? 'setwon-a' : 'setwon-b',
  };
}

function mkSnapshot(st) {
  const { sets_t1, sets_t2, pointsA, pointsB, currentSet, setHistory, servingTeam, status, winner } = st;
  return { sets_t1, sets_t2, pointsA, pointsB, currentSet, setHistory: [...setHistory], servingTeam, status, winner };
}

function initState(fromDetail, team1, team2) {
  const d = fromDetail || {};
  const rosterSize = Math.max(1, Number(d.rosterSize || 6));
  return {
    teamA: team1 || 'Team A',
    teamB: team2 || 'Team B',
    maxSets:     d.max_sets    ?? 5,
    sets_t1:     d.sets_t1     ?? d.setsA ?? 0,
    sets_t2:     d.sets_t2     ?? d.setsB ?? 0,
    pointsA:     d.pointsA     ?? 0,
    pointsB:     d.pointsB     ?? 0,
    currentSet:  d.currentSet  ?? 1,
    setHistory:  d.setHistory  ?? [],
    setTargets:  d.setTargets  ?? {},
    servingTeam: d.servingTeam ?? 'A',
    status:      d.status      ?? 'upcoming',
    winner:      d.winner      ?? null,
    pendingComplete: d.pendingComplete ?? (d.status !== 'completed' && Boolean(d.winner)),
    history:     d.history     ?? [],
    lastEvent:   null,
    rosterSize,
    rosterA:     d.rosterA     ?? Array(rosterSize).fill(''),
    rosterB:     d.rosterB     ?? Array(rosterSize).fill(''),
  };
}

function reducer(state, action) {
  switch (action.type) {
    case 'POINT': {
      if (state.status === 'completed') return state;
      const snap   = mkSnapshot(state);
      const newSt  = {
        ...state,
        status: state.status === 'upcoming' ? 'live' : state.status,
        history:  [...state.history.slice(-500), snap],
        lastEvent: null,
      };
      if (action.team === 'A') { newSt.pointsA++; newSt.servingTeam = 'A'; }
      else                     { newSt.pointsB++; newSt.servingTeam = 'B'; }
      return checkSetWin(newSt);
    }
    case 'UNDO': {
      if (!state.history.length) return state;
      const prev = state.history[state.history.length - 1];
      return {
        ...state,
        ...prev,
        history: state.history.slice(0, -1),
        lastEvent: 'undo',
      };
    }
    case 'SWITCH_SERVER':
      return { ...state, servingTeam: state.servingTeam === 'A' ? 'B' : 'A', lastEvent: null };
    case 'RESET':
      return initState(null, state.teamA, state.teamB);
    case 'HYDRATE':
      return initState(action.detail, action.teamA, action.teamB);
    case 'COMPLETE_MATCH':
      if (state.status === 'completed') return state;
      return { ...state, status: 'completed', pendingComplete: false, lastEvent: 'complete-match' };
    case 'SET_TARGET':
      return { ...state, setTargets: { ...state.setTargets, [state.currentSet]: action.target } };
    case 'SET_MAX_SETS': {
      const nextMaxSets = Math.max(1, Number(action.value || 1));
      return {
        ...state,
        maxSets: nextMaxSets,
        currentSet: Math.min(state.currentSet, nextMaxSets),
      };
    }
    case 'UPDATE_ROSTER':
      return { ...state, [action.team === 'A' ? 'rosterA' : 'rosterB']: action.roster };
    default:
      return state;
  }
}

/* ═══════════════════════════════════════════════════════════
   SUB-COMPONENT: ROSTER
═══════════════════════════════════════════════════════════ */
function Roster({ team, roster, teamData, dispatch }) {
  const squad = teamData?.squad || [];

  return (
    <div style={{ padding: '0.75rem', borderRight: team === 'A' ? '1px solid var(--color-border)' : 'none' }}>
      <h4 style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', marginBottom: '0.5rem', textAlign: team === 'A' ? 'left' : 'right' }}>ON-COURT ROSTER ({squad.length > 0 ? squad.length + ' Registered' : 'No Squad'})</h4>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '4px' }}>
        {roster.map((p, i) => {
          // Available players: the current player + whoever is on the bench (not on court)
          const bench = squad.filter(s => s.name === p || !roster.includes(s.name));
          
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: '4px' }}>
              <select 
                className="input-field interactive-select" 
                style={{ flex: 1, padding: '0.3rem 0.5rem', fontSize: '0.8rem', height: 'auto', background: 'transparent', border: 'none', color: p ? 'var(--color-text-main)' : 'var(--color-text-muted)' }}
                value={p}
                onChange={(e) => {
                  const newRoster = [...roster];
                  newRoster[i] = e.target.value;
                  dispatch({ type: 'UPDATE_ROSTER', team, roster: newRoster });
                }}
              >
                {p === '' && <option value="">- Slot {i + 1} -</option>}
                {bench.map((bPlayer, j) => (
                  <option key={j} value={bPlayer.name}>
                    {bPlayer.name} {bPlayer.is_substitute ? '(Sub)' : ''}
                  </option>
                ))}
              </select>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   COMPONENT
═══════════════════════════════════════════════════════════ */
export default function LiveVolleyballScorer({
  detail,
  patch,
  team1,
  team2,
  team1Data,
  team2Data,
  serveIcon = '🏐',
  allowSetCountConfig = false,
  initialSetTarget = null,
  showResetOnComplete = true,
  sportId = 'volleyball',
}) {
  const [state, dispatch] = useReducer(reducer, null, () =>
    initState(detail, team1, team2)
  );

  const tossDecided = Boolean(detail.toss_decided || (detail.toss_winner && detail.toss_decision));

  const [targetInput, setTargetInput] = useState(() => {
    const currentSet = Number(detail?.currentSet || 1);
    const configuredTarget = Number(detail?.setTargets?.[currentSet] ?? detail?.setTargets?.[1]);
    const fallbackTarget = Number(initialSetTarget);
    return Number.isFinite(configuredTarget) && configuredTarget > 0
      ? configuredTarget
      : (Number.isFinite(fallbackTarget) && fallbackTarget > 0 ? fallbackTarget : 25);
  });
  const [setOption, setSetOption] = useState(() => {
    const maxSets = Number(detail?.max_sets || 5);
    return [1, 3, 5].includes(maxSets) ? String(maxSets) : 'Custom';
  });
  const [customSetCount, setCustomSetCount] = useState(() => {
    const maxSets = Number(detail?.max_sets || 5);
    return [1, 3, 5].includes(maxSets) ? String(maxSets) : String(Math.max(1, maxSets));
  });

  // Auto-initialize rosters to starting 6 if completely empty
  useEffect(() => {
    if (state.rosterA.every(p => p === '') && team1Data?.squad) {
      const mainA = team1Data.squad.filter(p => !p.is_substitute).map(p => p.name).slice(0, state.rosterSize);
      if (mainA.length > 0) dispatch({ type: 'UPDATE_ROSTER', team: 'A', roster: [...mainA, ...Array(state.rosterSize - mainA.length).fill('')] });
    }
    if (state.rosterB.every(p => p === '') && team2Data?.squad) {
      const mainB = team2Data.squad.filter(p => !p.is_substitute).map(p => p.name).slice(0, state.rosterSize);
      if (mainB.length > 0) dispatch({ type: 'UPDATE_ROSTER', team: 'B', roster: [...mainB, ...Array(state.rosterSize - mainB.length).fill('')] });
    }
  }, [team1Data, team2Data, state.rosterA, state.rosterB, state.rosterSize]);

  // Push state up to parent whenever it changes (for auto-save)
  const stateRef = useRef(state);
  stateRef.current = state;

  const patchUpRef = useRef(patch);
  patchUpRef.current = patch;

  useEffect(() => {
    patchUpRef.current({
      max_sets:    state.maxSets,
      sets_t1:     state.sets_t1,
      sets_t2:     state.sets_t2,
      // full live state stored in detail so we can restore
      setsA:       state.sets_t1, // maintain setsA for compatibility if needed elsewhere
      setsB:       state.sets_t2,
      pointsA:     state.pointsA,
      pointsB:     state.pointsB,
      currentSet:  state.currentSet,
      setTargets:  state.setTargets,
      setHistory:  state.setHistory,
      servingTeam: state.servingTeam,
      status:      state.status,
      winner:      state.winner,
      history:     state.history,
      rosterSize:  state.rosterSize,
      rosterA:     state.rosterA,
      rosterB:     state.rosterB,
    });
    }, [state.maxSets, state.sets_t1, state.sets_t2, state.pointsA, state.pointsB,
      state.currentSet, state.status, state.winner, state.pendingComplete, state.servingTeam, state.history, state.setTargets, state.rosterSize, state.rosterA, state.rosterB, state.setHistory]);

  /* ── Animations ─────────────────────────────────────── */
  const flashRef   = useRef(null);
  const toastRef   = useRef(null);
  const toastTO    = useRef(null);
  const scoreARef  = useRef(null);
  const scoreBRef  = useRef(null);
  const prevPA     = useRef(state.pointsA);
  const prevPB     = useRef(state.pointsB);

  const showToast = useCallback((msg) => {
    const el = toastRef.current;
    if (!el) return;
    el.textContent = msg;
    el.classList.add('on');
    clearTimeout(toastTO.current);
    toastTO.current = setTimeout(() => el.classList.remove('on'), 2400);
  }, []);

  const doFlash = useCallback((cls) => {
    const el = flashRef.current;
    if (!el) return;
    el.className = `lvb-flash-overlay ${cls} go`;
    el.addEventListener('animationend', () => { el.className = 'lvb-flash-overlay'; }, { once: true });
  }, []);

  const bump = useCallback((ref) => {
    const el = ref.current;
    if (!el) return;
    el.classList.remove('lvb-bump');
    void el.offsetWidth;
    el.classList.add('lvb-bump');
    el.addEventListener('animationend', () => el.classList.remove('lvb-bump'), { once: true });
  }, []);

  useEffect(() => {
    if (state.pointsA !== prevPA.current) { bump(scoreARef); prevPA.current = state.pointsA; }
    if (state.pointsB !== prevPB.current) { bump(scoreBRef); prevPB.current = state.pointsB; }

    if (state.lastEvent?.startsWith('setwon')) {
      const t = state.lastEvent === 'setwon-a' ? state.teamA : state.teamB;
      const idx = state.setHistory.length;
      doFlash(state.lastEvent === 'setwon-a' ? 'fa' : 'fb');
      showToast(`${serveIcon} ${t} wins Set ${idx}!`);
    }
    if (state.lastEvent?.startsWith('match')) {
      const t = state.winner === 'A' ? state.teamA : state.teamB;
      doFlash(state.winner === 'A' ? 'fa' : 'fb');
      showToast(`🏆 ${t} wins the final set! Complete the match when ready.`);
    }
  }, [state.lastEvent, state.pointsA, state.pointsB, bump, doFlash, serveIcon, showToast, state.setHistory.length, state.teamA, state.teamB, state.winner]);

  /* ── Deuce label ────────────────────────────────────── */
  const tgt = state.setTargets[state.currentSet];
  const setConfigLocked = state.setHistory.length > 0 || state.pointsA > 0 || state.pointsB > 0 || state.status === 'completed';
  const isAwaitingCompletion = Boolean(state.winner) && state.status !== 'completed';
  const [completionPromptOpen, setCompletionPromptOpen] = useState(false);
  const wasAwaitingCompletion = useRef(false);

  useEffect(() => {
    if (isAwaitingCompletion && !wasAwaitingCompletion.current) {
      setCompletionPromptOpen(true);
    }
    if (!isAwaitingCompletion) {
      setCompletionPromptOpen(false);
    }
    wasAwaitingCompletion.current = isAwaitingCompletion;
  }, [isAwaitingCompletion]);

  useEffect(() => {
    const maxSets = Number(state.maxSets || 5);
    if ([1, 3, 5].includes(maxSets)) {
      setSetOption(String(maxSets));
      setCustomSetCount(String(maxSets));
    } else {
      setSetOption('Custom');
      setCustomSetCount(String(Math.max(1, maxSets)));
    }
  }, [state.maxSets]);

  useEffect(() => {
    if (tgt) return;
    const fallbackTarget = Number(state.setTargets[1]);
    if (Number.isFinite(fallbackTarget) && fallbackTarget > 0) {
      setTargetInput(fallbackTarget);
      return;
    }
    const configuredDefault = Number(initialSetTarget);
    if (Number.isFinite(configuredDefault) && configuredDefault > 0) {
      setTargetInput(configuredDefault);
    }
  }, [state.currentSet, state.setTargets, tgt, initialSetTarget]);

  let deuceLabel = '';
  if (tgt && state.status === 'live' && state.pointsA >= tgt - 1 && state.pointsB >= tgt - 1) {
    if      (state.pointsA === state.pointsB) deuceLabel = '⚡ DEUCE';
    else if (state.pointsA > state.pointsB)   deuceLabel = `✨ ADV · ${state.teamA.toUpperCase()}`;
    else                                       deuceLabel = `✨ ADV · ${state.teamB.toUpperCase()}`;
  }

  const canUndo = state.history.length > 0;
  const finished = state.status === 'completed';

  /* ── Actions ────────────────────────────────────────── */
  const point = (team) => {
    if (finished) return;
    if (navigator.vibrate) navigator.vibrate(25);
    dispatch({ type: 'POINT', team });
  };
  const undo = () => {
    if (navigator.vibrate) navigator.vibrate([15, 20, 15]);
    dispatch({ type: 'UNDO' });
  };
  const completeMatch = () => {
    dispatch({ type: 'COMPLETE_MATCH' });
    setCompletionPromptOpen(false);
  };
  const keepEditing = () => {
    setCompletionPromptOpen(false);
  };

  if (!tossDecided) {
    return (
      <div className="lvb-toss-wrapper" style={{ padding: '2rem', textAlign: 'center' }}>
        <CoinToss
          sportId={sportId}
          team1Name={team1}
          team2Name={team2}
          initialSetCount={state.maxSets}
          onTossComplete={(tossData) => {
            const winner = tossData.toss_winner === 't1' ? 'A' : 'B';
            const selectedMaxSets = Number(tossData.max_sets);
            if (Number.isFinite(selectedMaxSets) && selectedMaxSets > 0) {
              dispatch({ type: 'SET_MAX_SETS', value: selectedMaxSets });
            }
            patch({
              toss_winner: tossData.toss_winner,
              toss_decision: tossData.toss_decision,
              toss_decided: true,
              ...(Number.isFinite(selectedMaxSets) && selectedMaxSets > 0 ? { max_sets: selectedMaxSets } : {}),
              servingTeam: winner, // Default serving team to toss winner
            });
          }}
        />
      </div>
    );
  }

  return (
    <>
      {completionPromptOpen && isAwaitingCompletion && (
        <div className="lvb-complete-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="lvb-complete-title">
          <div className="lvb-complete-modal">
            <div className="lvb-complete-modal-badge">FINAL SET COMPLETE</div>
            <h3 id="lvb-complete-title">Do you want to complete the match?</h3>
            <p>
              The last set has been won, but the score is still editable. You can undo the last point or make other changes before finishing the match.
            </p>
            <div className="lvb-complete-modal-actions">
              <button type="button" className="btn-outline" onClick={keepEditing}>Keep Editing</button>
              <button type="button" className="btn-primary" onClick={completeMatch}>Complete Match</button>
            </div>
          </div>
        </div>
      )}
      {/* Flash overlay */}
      <div ref={flashRef} className="lvb-flash-overlay" />
      {/* Toast */}
      <div ref={toastRef} className="lvb-toast" />

      {/* ── Toolbar ── */}
      <div className="lvb-toolbar">
        {allowSetCountConfig && (
          <div className="lvb-set-config">
            <label className="lvb-set-config-label">Sets</label>
            <select
              className="input-field lvb-set-select"
              value={setOption}
              disabled={setConfigLocked}
              onChange={(e) => {
                const selected = e.target.value;
                setSetOption(selected);
                if (selected === 'Custom') {
                  const parsedCustom = Math.max(1, Number(customSetCount || 1));
                  dispatch({ type: 'SET_MAX_SETS', value: parsedCustom });
                  return;
                }
                const parsed = Math.max(1, Number(selected));
                setCustomSetCount(String(parsed));
                dispatch({ type: 'SET_MAX_SETS', value: parsed });
              }}
            >
              <option value="1">1 Set</option>
              <option value="3">Best of 3</option>
              <option value="5">Best of 5</option>
              <option value="Custom">Custom</option>
            </select>
            {setOption === 'Custom' && (
              <input
                type="number"
                min={1}
                className="input-field lvb-set-custom-input"
                value={customSetCount}
                disabled={setConfigLocked}
                onChange={(e) => {
                  const raw = e.target.value;
                  setCustomSetCount(raw);
                  const parsed = Number(raw);
                  if (Number.isFinite(parsed) && parsed >= 1) {
                    dispatch({ type: 'SET_MAX_SETS', value: parsed });
                  }
                }}
                placeholder="No. of sets"
              />
            )}
          </div>
        )}
        <div className="lvb-set-info">
          <span>SET</span>
          <span className="lvb-set-num">{state.currentSet}</span>
          <span>OF {state.maxSets}</span>
        </div>
        <div className={`lvb-status-badge ${finished ? 'finished' : 'live'}`}>
          {finished ? (
            '✓ FINISHED'
          ) : (
            <><div className="lvb-pulse" />LIVE</>
          )}
        </div>
      </div>

      {/* ── Sets row ── */}
      <div className="lvb-sets-row">
        <div className="lvb-team-col">
          <span className="lvb-team-label">{state.teamA}</span>
          <span className="lvb-sets-count">{state.sets_t1}</span>
          <span className={`lvb-serving-tag ${state.servingTeam !== 'A' ? 'hidden' : ''}`}>
            <span className="lvb-srv-ball">{serveIcon}</span> SERVING
          </span>
        </div>
        <div className="lvb-team-col right">
          <span className="lvb-team-label">{state.teamB}</span>
          <span className="lvb-sets-count">{state.sets_t2}</span>
          <span className={`lvb-serving-tag ${state.servingTeam !== 'B' ? 'hidden' : ''}`}>
            SERVING <span className="lvb-srv-ball">{serveIcon}</span>
          </span>
        </div>
      </div>

      {/* ── Score ── */}
      <div className="lvb-score-area">
        <span ref={scoreARef} className="lvb-score-num a">{state.pointsA}</span>
        <span className="lvb-score-sep">—</span>
        <span ref={scoreBRef} className="lvb-score-num b">{state.pointsB}</span>
        <span className={`lvb-deuce ${deuceLabel ? 'on' : ''}`}>{deuceLabel}</span>
      </div>

      {/* ── Score buttons or Target prompt ── */}
      {!tgt ? (
        <div style={{ padding: '3rem 1rem', textAlign: 'center', border: '1px solid var(--color-border)', borderTop: 'none', background: 'var(--color-bg-surface)', margin: 0 }}>
          <h3 style={{ marginBottom: '1rem', color: 'var(--color-primary)' }}>Set {state.currentSet} Target Points</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '1.5rem' }}>Enter the number of points to win Set {state.currentSet}.</p>
          <input 
            type="number" 
            value={targetInput}
            onChange={(e) => setTargetInput(parseInt(e.target.value, 10) || 0)}
            className="input-field" 
            style={{ width: '120px', textAlign: 'center', fontSize: '1.5rem', marginBottom: '1.5rem', padding: '1rem' }} 
          />
          <br/>
          <button 
            type="button" 
            className="btn-primary" 
            style={{ padding: '0.75rem 2rem', fontSize: '1rem' }}
            onClick={() => {
              if(targetInput > 0) dispatch({ type: 'SET_TARGET', target: targetInput });
            }}>
            Begin Set {state.currentSet}
          </button>
        </div>
      ) : (
        <div className="lvb-btns">
          <button
            type="button"
            className={`lvb-score-btn lvb-btn-a ${finished ? 'disabled' : ''}`}
            onClick={() => point('A')}
          >
            <span className="lvb-btn-tag">TEAM A</span>
            <span className="lvb-btn-plus">+1</span>
            <span className="lvb-btn-name">{state.teamA}</span>
          </button>
          <button
            type="button"
            className={`lvb-score-btn lvb-btn-b ${finished ? 'disabled' : ''}`}
            onClick={() => point('B')}
          >
            <span className="lvb-btn-tag">TEAM B</span>
            <span className="lvb-btn-plus">+1</span>
            <span className="lvb-btn-name">{state.teamB}</span>
          </button>
        </div>
      )}

      {/* ── Controls ── */}
      <div className="lvb-controls">
        <button
          type="button"
          className="lvb-btn-undo"
          onClick={undo}
          disabled={!canUndo}
        >
          ↩ UNDO LAST POINT
        </button>
        <button
          type="button"
          className="lvb-btn-switch"
          onClick={() => dispatch({ type: 'SWITCH_SERVER' })}
        >
          {serveIcon} SWITCH SERVER
        </button>
      </div>

      {isAwaitingCompletion && (
        <div className="lvb-complete-banner">
          <div className="lvb-complete-banner-copy">
            <div className="lvb-complete-banner-title">Match ready to complete</div>
            <div className="lvb-complete-banner-text">
              Review the score, undo the last point if needed, then finish the match when you are ready.
            </div>
          </div>
          <button type="button" className="btn-primary" onClick={completeMatch}>Complete Match</button>
        </div>
      )}

      {/* ── Roster Setup ── */}
      <div className="lvb-rosters" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0', border: '1px solid var(--color-border)', borderTop: 'none', background: 'var(--color-bg-surface-elevated)' }}>
        <Roster team="A" teamName={state.teamA} roster={state.rosterA} teamData={team1Data} dispatch={dispatch} />
        <Roster team="B" teamName={state.teamB} roster={state.rosterB} teamData={team2Data} dispatch={dispatch} />
      </div>

      {/* ── Set History ── */}
      <div className="lvb-history">
        <div className="lvb-history-title">Set History</div>
        <div className="lvb-history-chips">
          {state.setHistory.length === 0 ? (
            <span style={{ color: 'var(--color-text-muted)', fontSize: '0.78rem' }}>
              No completed sets yet
            </span>
          ) : (
            state.setHistory.map((h, i) => (
              <div key={i} className="lvb-chip">
                <span className="lvb-chip-lbl">S{i + 1}</span>
                <span className="lvb-chip-score">{h.a}–{h.b}</span>
                <span className={`lvb-chip-dot ${h.winner.toLowerCase()}`}>●</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Match Won Banner ── */}
      {finished && state.winner && (
        <div className="lvb-win-banner">
          <span className="lvb-win-icon">🏆</span>
          <div>
            <div className="lvb-win-label">Match Winner</div>
            <div className={`lvb-win-name ${state.winner.toLowerCase()}`}>
              {state.winner === 'A' ? state.teamA : state.teamB}
            </div>
            <div className="lvb-win-sets">{state.sets_t1} – {state.sets_t2} sets</div>
          </div>
          {showResetOnComplete && (
            <button
              type="button"
              className="lvb-btn-reset"
              onClick={() => dispatch({ type: 'RESET' })}
            >
              🔄 NEW MATCH
            </button>
          )}
        </div>
      )}
    </>
  );
}
