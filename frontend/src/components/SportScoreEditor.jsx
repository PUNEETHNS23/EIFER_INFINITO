import React, { useEffect, useState, useRef, useCallback } from 'react';
import api from '../api';
import { hydrateScoreDetail } from '../sports/sportsConfig';
import LiveCricketScorer from './LiveCricketScorer';
import LiveVolleyballScorer from './LiveVolleyballScorer';
import LiveFootballScorer from './LiveFootballScorer';
import './sportScoreboards.css';

function racketToVolleyballDetail(detail, sid) {
  const d = detail || {};
  const target = Number(d.point_limit === 'Custom' ? d.custom_limit : d.point_limit) || (sid === 'badminton' ? 21 : 11);
  const currentSet = Number(d.currentSet || ((d.past_games || []).length + 1) || 1);
  const setTargets = d.setTargets || { [currentSet]: target };
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

  return {
    max_sets: d.match_format === 'Best of 5' ? 5 : d.match_format === '1 Game' ? 1 : 3,
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
  const next = { ...prevDetail };

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
  if (partial.max_sets != null) next.match_format = Number(partial.max_sets) === 5 ? 'Best of 5' : Number(partial.max_sets) === 1 ? '1 Game' : 'Best of 3';

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
    if (!['badminton', 'table-tennis', 'tug-of-war'].includes(sid)) return;
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

    const format = detail.match_format || 'Best of 3';
    const gamesToWin = format === 'Best of 5' ? 3 : format === '1 Game' ? 1 : 2;
    const t1Games = Number(detail.games_t1 || 0);
    const t2Games = Number(detail.games_t2 || 0);
    const hasWinner = t1Games >= gamesToWin || t2Games >= gamesToWin;

    if (hasWinner && status !== 'completed') {
      setStatus('completed');
      return;
    }

    if (!hasWinner && detail.toss_decided && status === 'upcoming') {
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
      form = <LiveCricketScorer detail={detail} patch={patch} team1={team1} team2={team2} team1Data={team1Data} team2Data={team2Data} />;
      break;
    case 'carrom':
      form = (
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
      form = (
        <div className="sbe-grid">
          <Num label={`${team1} points`} value={detail.points_t1} onChange={(v) => patch({ points_t1: v })} />
          <Num label={`${team2} points`} value={detail.points_t2} onChange={(v) => patch({ points_t2: v })} />
        </div>
      );
      break;
    case 'chess':
      form = (
        <div className="sbe-field">
          <span>Result</span>
          <select className="input-field" value={detail.winner || 'draw'} onChange={(e) => patch({ winner: e.target.value })}>
            <option value="draw">Draw</option>
            <option value="t1">{team1} wins</option>
            <option value="t2">{team2} wins</option>
          </select>
        </div>
      );
      break;
    case 'athletics':
      form = (
        <div className="sbe-grid">
          <Num label={`${team1} time (sec)`} value={detail.time_t1_sec} onChange={(v) => patch({ time_t1_sec: v })} step={0.01} />
          <Num label={`${team2} time (sec)`} value={detail.time_t2_sec} onChange={(v) => patch({ time_t2_sec: v })} step={0.01} />
        </div>
      );
      break;
    case 'weight-lifting':
      form = (
        <div className="sbe-grid">
          <Num label={`${team1} kg`} value={detail.kg_t1} onChange={(v) => patch({ kg_t1: v })} />
          <Num label={`${team2} kg`} value={detail.kg_t2} onChange={(v) => patch({ kg_t2: v })} />
        </div>
      );
      break;
    case 'badminton':
    case 'table-tennis': {
      const adaptedDetail = racketToVolleyballDetail(detail, sid);
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
        />
      );
      break;
    }
    case 'arm-wrestling':
      form = (
        <div className="sbe-grid">
          <Num label={`${team1} rounds`} value={detail.rounds_t1} onChange={(v) => patch({ rounds_t1: v })} />
          <Num label={`${team2} rounds`} value={detail.rounds_t2} onChange={(v) => patch({ rounds_t2: v })} />
        </div>
      );
      break;
    case 'tug-of-war':
      form = (
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
          {team1} <span className="sbe-vs">vs</span> {team2}
        </h3>
        <span className="sbe-id">Match #{match.id}</span>
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
            <option value="live">Live</option>
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
