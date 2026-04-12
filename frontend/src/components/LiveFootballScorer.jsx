import React, { useMemo, useState } from 'react';
import './LiveFootballScorer.css';

function getSquadNames(teamData) {
  const squad = teamData?.squad || [];
  return squad.map((p) => p?.name).filter(Boolean);
}

export default function LiveFootballScorer({ detail, patch, team1, team2, team1Data, team2Data, matchStatus, onEndMatch }) {
  const [history, setHistory] = useState([]);
  const [minute, setMinute] = useState('');
  const [t1Scorer, setT1Scorer] = useState('');
  const [t2Scorer, setT2Scorer] = useState('');
  const [note, setNote] = useState('');

  const team1Names = useMemo(() => getSquadNames(team1Data), [team1Data]);
  const team2Names = useMemo(() => getSquadNames(team2Data), [team2Data]);

  const pushHistory = () => {
    setHistory((h) => [...h, JSON.stringify(detail)]);
  };

  const undo = () => {
    if (!history.length) return;
    const prev = JSON.parse(history[history.length - 1]);
    patch(prev);
    setHistory((h) => h.slice(0, -1));
  };

  const normalizeMinute = (m) => {
    const n = Number.parseInt(m, 10);
    if (Number.isNaN(n) || n < 0) return null;
    return Math.min(130, n);
  };

  const addGoal = (teamKey) => {
    pushHistory();
    const nowMinute = normalizeMinute(minute);
    const currentEvents = Array.isArray(detail.goal_events) ? [...detail.goal_events] : [];
    const scorer = teamKey === 't1' ? t1Scorer : t2Scorer;

    const newEvent = {
      type: 'goal',
      team: teamKey,
      minute: nowMinute,
      scorer: scorer || 'Unknown',
      note: note || '',
      created_at: new Date().toISOString(),
    };

    const updates = {
      ...detail,
      status: detail.status === 'upcoming' ? 'live' : detail.status,
      goals_t1: Number(detail.goals_t1 || 0) + (teamKey === 't1' ? 1 : 0),
      goals_t2: Number(detail.goals_t2 || 0) + (teamKey === 't2' ? 1 : 0),
      goal_events: [newEvent, ...currentEvents],
    };

    patch(updates);
    setNote('');
    if (teamKey === 't1') setT1Scorer('');
    else setT2Scorer('');
  };

  const removeGoal = (teamKey) => {
    pushHistory();
    patch({
      ...detail,
      goals_t1: Math.max(0, Number(detail.goals_t1 || 0) - (teamKey === 't1' ? 1 : 0)),
      goals_t2: Math.max(0, Number(detail.goals_t2 || 0) - (teamKey === 't2' ? 1 : 0)),
    });
  };

  const clearTimeline = () => {
    pushHistory();
    patch({ ...detail, goal_events: [] });
  };

  const events = Array.isArray(detail.goal_events) ? detail.goal_events : [];

  return (
    <div className="lfs-wrap">
      <div className="lfs-top-grid">
        <label className="sbe-field">
          <span>Venue</span>
          <input
            type="text"
            className="input-field"
            value={detail.venue || ''}
            onChange={(e) => patch({ venue: e.target.value })}
            placeholder="Enter stadium"
          />
        </label>
        <label className="sbe-field">
          <span>Duration (minutes)</span>
          <input
            type="number"
            className="input-field"
            min={60}
            max={130}
            value={detail.match_minutes || 90}
            onChange={(e) => patch({ match_minutes: Number(e.target.value) || 90 })}
          />
        </label>
        <label className="sbe-field">
          <span>Event minute</span>
          <input
            type="number"
            className="input-field"
            min={0}
            max={130}
            value={minute}
            onChange={(e) => setMinute(e.target.value)}
            placeholder="e.g. 67"
          />
        </label>
      </div>

      <div className="lfs-scorebar">
        <div className="lfs-team-col">
          <div className="lfs-team-name">{team1}</div>
          <div className="lfs-big">{Number(detail.goals_t1 || 0)}</div>
          <div className="lfs-actions">
            <button type="button" className="btn-score lfs-goal-btn t1" onClick={() => addGoal('t1')}>+ Goal</button>
            <button type="button" className="btn-outline lfs-minus-btn" onClick={() => removeGoal('t1')}>- Goal</button>
          </div>
          <label className="sbe-field">
            <span>Scorer ({team1})</span>
            <select className="input-field" value={t1Scorer} onChange={(e) => setT1Scorer(e.target.value)}>
              <option value="">Select scorer</option>
              {team1Names.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="lfs-mid">VS</div>

        <div className="lfs-team-col">
          <div className="lfs-team-name">{team2}</div>
          <div className="lfs-big">{Number(detail.goals_t2 || 0)}</div>
          <div className="lfs-actions">
            <button type="button" className="btn-score lfs-goal-btn t2" onClick={() => addGoal('t2')}>+ Goal</button>
            <button type="button" className="btn-outline lfs-minus-btn" onClick={() => removeGoal('t2')}>- Goal</button>
          </div>
          <label className="sbe-field">
            <span>Scorer ({team2})</span>
            <select className="input-field" value={t2Scorer} onChange={(e) => setT2Scorer(e.target.value)}>
              <option value="">Select scorer</option>
              {team2Names.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="lfs-note-row">
        <label className="sbe-field lfs-note-field">
          <span>Event note</span>
          <input
            type="text"
            className="input-field"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Counter attack"
          />
        </label>
        <button type="button" className="btn-outline" onClick={undo} disabled={!history.length}>Undo ({history.length})</button>
        <button type="button" className="btn-outline" onClick={clearTimeline} disabled={!events.length}>Clear Timeline</button>
        <button
          type="button"
          className="btn-primary"
          onClick={onEndMatch}
          disabled={matchStatus === 'completed'}
          style={{ background: '#dc2626', borderColor: '#dc2626', minWidth: '140px' }}
        >
          {matchStatus === 'completed' ? 'Match Ended' : 'End Match'}
        </button>
      </div>

      <div className="lfs-timeline">
        <h4>Goal Timeline</h4>
        {!events.length && <p className="lfs-empty">No goal events yet.</p>}
        {events.map((ev, idx) => (
          <div key={`${ev.created_at || 'evt'}-${idx}`} className={`lfs-event ${ev.team}`}>
            <div className="lfs-event-time">{ev.minute === null || ev.minute === undefined ? 'NA' : `${ev.minute}'`}</div>
            <div className="lfs-event-main">
              <div className="lfs-event-title">{ev.team === 't1' ? team1 : team2} goal</div>
              <div className="lfs-event-sub">{ev.scorer || 'Unknown'}{ev.note ? ` - ${ev.note}` : ''}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
