import React from 'react';
import { getSportMeta } from '../sports/sportsConfig';
import './sportScoreboards.css';

function Row({ labelL, labelR, valL, valR, sub }) {
  return (
    <div className="sb-row">
      <div className="sb-side sb-left">
        <span className="sb-name">{labelL}</span>
        <span className="sb-val">{valL}</span>
      </div>
      {sub && <div className="sb-sub">{sub}</div>}
      <div className="sb-side sb-right">
        <span className="sb-name">{labelR}</span>
        <span className="sb-val">{valR}</span>
      </div>
    </div>
  );
}

function LegacyBoard({ team1, team2, s1, s2, theme }) {
  return (
    <div className={`sport-board sb-legacy sb-theme-${theme}`}>
      <div className="sb-duel">
        <span className="sb-team">{team1}</span>
        <div className="sb-big-score">
          <span>{s1}</span>
          <span className="sb-colon">:</span>
          <span>{s2}</span>
        </div>
        <span className="sb-team">{team2}</span>
      </div>
    </div>
  );
}

/**
 * Public scoreboard for a match (read-only).
 */
export default function SportScoreboard({ match, compact = false }) {
  const sportId = match.sport_id;
  const meta = getSportMeta(sportId);
  const d = match.score_detail;
  const team1 = match.team1 || 'Team 1';
  const team2 = match.team2 || 'Team 2';
  const theme = meta.theme || 'default';

  if (!d || Object.keys(d).length === 0) {
    return (
      <LegacyBoard team1={team1} team2={team2} s1={match.score_t1} s2={match.score_t2} theme={theme} />
    );
  }

  const wrap = (inner) => (
    <div className={`sport-board sb-theme-${theme} ${compact ? 'sb-compact' : ''}`} data-sport={sportId}>
      {inner}
    </div>
  );

  switch (sportId) {
    case 'football':
      return wrap(
        <Row labelL={team1} labelR={team2} valL={d.goals_t1 ?? 0} valR={d.goals_t2 ?? 0} sub="GOALS" />
      );
    case 'volleyball':
      return wrap(
        <Row labelL={team1} labelR={team2} valL={d.sets_t1 ?? 0} valR={d.sets_t2 ?? 0} sub="SETS WON" />
      );
    case 'cricket':
      if (compact) {
        return wrap(
          <>
            <div className="sb-cricket">
              <div>
                <div className="sb-cr-label">{team1}</div>
                <div className="sb-cr-line">{d.runs_t1 ?? 0}/{d.wickets_t1 ?? 0}</div>
              </div>
              <div className="sb-vs">vs</div>
              <div>
                <div className="sb-cr-label">{team2}</div>
                <div className="sb-cr-line">{d.runs_t2 ?? 0}/{d.wickets_t2 ?? 0}</div>
              </div>
            </div>
            <div className="sb-rally" style={{ fontSize: '0.85rem' }}>Over: {d.over_progression || '-'} | Last: {d.current_ball_result || '-'}</div>
          </>
        );
      }
      
      const isChasing = Number(d.innings || 1) === 2 && d.target > 0;

      return wrap(
        <div className="sb-cricket-premium">
          <div className="sb-cricket-header-row">
             <span className="cricket-status-badge">{match.status.toUpperCase()}</span>
             <span className="cricket-toss">{d.toss || 'Toss not updated'}</span>
          </div>
          
          <div className="cricket-main-scorebox">
            <div className="cricket-team-row">
              <span className="cricket-team-name">{team1}</span>
              <span className="cricket-score-digits">{d.runs_t1 ?? 0}/{d.wickets_t1 ?? 0} <span className="cricket-overs-digits">({d.overs_t1 || '0.0'})</span></span>
            </div>
            <div className="cricket-team-row">
              <span className="cricket-team-name">{team2}</span>
              <span className="cricket-score-digits">{d.runs_t2 ?? 0}/{d.wickets_t2 ?? 0} <span className="cricket-overs-digits">({d.overs_t2 || '0.0'})</span></span>
            </div>
          </div>

          {isChasing && (
            <div className="cricket-target-box">
               <span className="cricket-target-text">Target: {d.target}</span>
               <span className="cricket-req-text">Need {d.target - (d.runs_t2 || 0)} runs</span>
               <span className="cricket-req-rate">RRR: {d.required_run_rate ?? '0.00'}</span>
            </div>
          )}

          <div className="cricket-metrics-bar">
             <span>Live RR: {d.run_rate ?? '0.00'}</span>
             <span>Last Ball: {d.current_ball_result || '-'}</span>
          </div>

          <div className="cricket-players-card">
            <table className="cricket-stats-table">
               <thead>
                 <tr>
                    <th className="left-align">Batter</th>
                    <th>R</th>
                    <th>B</th>
                    <th>4s</th>
                    <th>6s</th>
                    <th>SR</th>
                 </tr>
               </thead>
               <tbody>
                  <tr>
                     <td className="left-align highlighter">{d.striker || 'Batter 1'} <span className="cricket-star">⭐</span></td>
                     <td>{d.striker_runs ?? 0}</td>
                     <td>{d.striker_balls ?? 0}</td>
                     <td>{d.striker_fours ?? 0}</td>
                     <td>{d.striker_sixes ?? 0}</td>
                     <td>{d.striker_sr ?? 0}</td>
                  </tr>
                  <tr>
                     <td className="left-align highlighter">{d.non_striker || 'Batter 2'}</td>
                     <td>{d.non_striker_runs ?? 0}</td>
                     <td>{d.non_striker_balls ?? 0}</td>
                     <td>{d.non_striker_fours ?? 0}</td>
                     <td>{d.non_striker_sixes ?? 0}</td>
                     <td>{d.non_striker_sr ?? 0}</td>
                  </tr>
               </tbody>
            </table>
          </div>

          <div className="cricket-players-card">
             <table className="cricket-stats-table">
               <thead>
                 <tr>
                    <th className="left-align">Bowler</th>
                    <th>O</th>
                    <th>M</th>
                    <th>R</th>
                    <th>W</th>
                    <th>ECON</th>
                 </tr>
               </thead>
               <tbody>
                  <tr>
                     <td className="left-align highlighter">{d.current_bowler || 'Current Bowler'}</td>
                     <td>{d.bowler_overs || '0.0'}</td>
                     <td>-</td>
                     <td>{d.bowler_runs ?? 0}</td>
                     <td>{d.bowler_wickets ?? 0}</td>
                     <td>{d.bowler_econ ?? 0}</td>
                  </tr>
               </tbody>
             </table>
          </div>

          <div className="cricket-recent-balls">
             <span className="cricket-recent-label">This Over:</span>
             <div className="cricket-balls-list">
                {(d.over_progression || '').split(' ').filter(Boolean).map((b, i) => (
                   <span key={i} className={`cricket-ball-circle ${b === 'W' ? 'ball-w' : (b === '4' || b === '6' ? 'ball-boundary' : 'ball-normal')}`}>{b}</span>
                ))}
             </div>
          </div>
        </div>
      );
    case 'carrom':
      return wrap(
        <Row labelL={team1} labelR={team2} valL={d.points_t1 ?? 0} valR={d.points_t2 ?? 0} sub="BOARD POINTS" />
      );
    case 'kho-kho':
      return wrap(
        <Row labelL={team1} labelR={team2} valL={d.points_t1 ?? 0} valR={d.points_t2 ?? 0} sub="POINTS" />
      );
    case 'chess': {
      const w = (d.winner || 'draw').toLowerCase();
      let line = 'Draw';
      if (w === 't1') line = `${team1} wins`;
      else if (w === 't2') line = `${team2} wins`;
      return wrap(
        <div className="sb-chess">
          <span className="sb-chess-result">{line}</span>
        </div>
      );
    }
    case 'athletics':
      return wrap(
        <Row
          labelL={team1}
          labelR={team2}
          valL={Number(d.time_t1_sec ?? 0).toFixed(2)}
          valR={Number(d.time_t2_sec ?? 0).toFixed(2)}
          sub="TIME (SEC) · LOWER WINS"
        />
      );
    case 'weight-lifting':
      return wrap(
        <Row labelL={team1} labelR={team2} valL={d.kg_t1 ?? 0} valR={d.kg_t2 ?? 0} sub="BEST LIFT (KG)" />
      );
    case 'badminton':
    case 'table-tennis': {
      const label = sportId === 'badminton' ? 'BADMINTON' : 'TABLE TENNIS';
      return wrap(
        <>
          <Row labelL={team1} labelR={team2} valL={d.games_t1 ?? 0} valR={d.games_t2 ?? 0} sub={`${label} · GAMES WON`} />
          <div className="sb-rally">
            <span>
              Current: {d.current_p1 ?? 0} — {d.current_p2 ?? 0}
            </span>
          </div>
        </>
      );
    }
    case 'arm-wrestling':
    case 'tug-of-war':
      return wrap(
        <Row
          labelL={team1}
          labelR={team2}
          valL={d.rounds_t1 ?? 0}
          valR={d.rounds_t2 ?? 0}
          sub={sportId === 'tug-of-war' ? 'PULLS WON (BEST OF 3)' : 'ROUNDS WON'}
        />
      );
    case 'esports':
      return wrap(<Row labelL={team1} labelR={team2} valL={d.maps_t1 ?? 0} valR={d.maps_t2 ?? 0} sub="MAPS WON" />);
    default:
      return wrap(
        <Row labelL={team1} labelR={team2} valL={d.score_t1 ?? match.score_t1} valR={d.score_t2 ?? match.score_t2} sub="SCORE" />
      );
  }
}
