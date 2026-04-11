import React, { useEffect, useState, useRef, useCallback } from 'react';
import api from '../api';
import { hydrateScoreDetail } from '../sports/sportsConfig';
import LiveCricketScorer from './LiveCricketScorer';
import LiveBadmintonScorer from './LiveBadmintonScorer';
import './sportScoreboards.css';

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

export default function SportScoreEditor({ match, onSaved }) {
  const sid = match.sport_id;
  const [detail, setDetail] = useState(() => hydrateScoreDetail(sid, match));
  const [status, setStatus] = useState(match.status || 'upcoming');
  const [team1Data, setTeam1Data] = useState(null);
  const [team2Data, setTeam2Data] = useState(null);

  useEffect(() => {
    setDetail(hydrateScoreDetail(sid, match));
    setStatus(match.status || 'upcoming');
  }, [match.id, sid, match.score_detail, match.status, match.score_t1, match.score_t2]);

  useEffect(() => {
    if (sid === 'cricket' || sid === 'badminton' || sid === 'table-tennis') {
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

  // For interactive sports: auto-save whenever detail changes (each point)
  const saveTimeoutRef = useRef(null);
  useEffect(() => {
    if (!['cricket', 'badminton', 'table-tennis'].includes(sid)) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      api.put(`/matches/${match.id}`, { score_detail: detail, status });
    }, 600); // debounce 600ms
    return () => clearTimeout(saveTimeoutRef.current);
  }, [detail, sid, match.id, status]);

  const patch = (partial) => setDetail((prev) => ({ ...prev, ...partial }));

  const team1 = match.team1 || 'Team 1';
  const team2 = match.team2 || 'Team 2';

  let form = null;
  switch (sid) {
    case 'football':
      form = (
        <div className="sbe-grid">
          <Num label={`${team1} goals`} value={detail.goals_t1} onChange={(v) => patch({ goals_t1: v })} />
          <Num label={`${team2} goals`} value={detail.goals_t2} onChange={(v) => patch({ goals_t2: v })} />
        </div>
      );
      break;
    case 'volleyball':
      form = (
        <div className="sbe-grid">
          <Num label={`${team1} sets`} value={detail.sets_t1} onChange={(v) => patch({ sets_t1: v })} />
          <Num label={`${team2} sets`} value={detail.sets_t2} onChange={(v) => patch({ sets_t2: v })} />
        </div>
      );
      break;
    case 'cricket':
      form = <LiveCricketScorer detail={detail} patch={patch} team1={team1} team2={team2} team1Data={team1Data} team2Data={team2Data} />;
      break;
    case 'carrom':
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
    case 'table-tennis':
      form = <LiveBadmintonScorer sid={sid} detail={detail} patch={patch} team1={team1} team2={team2} team1Data={team1Data} team2Data={team2Data} />;
      break;
    case 'arm-wrestling':
    case 'tug-of-war':
      form = (
        <div className="sbe-grid">
          <Num label={`${team1} rounds`} value={detail.rounds_t1} onChange={(v) => patch({ rounds_t1: v })} />
          <Num label={`${team2} rounds`} value={detail.rounds_t2} onChange={(v) => patch({ rounds_t2: v })} />
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
          <select className="input-field" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="upcoming">Upcoming</option>
            <option value="live">Live</option>
            <option value="completed">Completed</option>
          </select>
        </label>
      </div>
      <button type="button" className="btn-primary sbe-save" onClick={save}>
        Save score
      </button>
    </div>
  );
}
