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
    case 'football': {
      const goalEvents = Array.isArray(d.goal_events) ? d.goal_events : [];
      const sortByMinute = (a, b) => {
        const am = Number.isFinite(Number(a?.minute)) ? Number(a.minute) : 999;
        const bm = Number.isFinite(Number(b?.minute)) ? Number(b.minute) : 999;
        return am - bm;
      };
      const team1Events = goalEvents.filter((ev) => ev.team === 't1').sort(sortByMinute);
      const team2Events = goalEvents.filter((ev) => ev.team === 't2').sort(sortByMinute);
      const goalsT1 = d.goals_t1 ?? 0;
      const goalsT2 = d.goals_t2 ?? 0;

      return wrap(
        <div className={`sb-vball sb-football-vball ${compact ? 'compact' : ''}`}>
          <div className="sb-vball-top">
            <div className="sb-vball-team left">
              <span className="sb-vball-name">{team1}</span>
              <span className="sb-vball-sets-num">{goalsT1}</span>
            </div>

            <div className="sb-vball-center">
              <div className="sb-vball-set-lbl">GOALS</div>
            </div>

            <div className="sb-vball-team right">
              <span className="sb-vball-name">{team2}</span>
              <span className="sb-vball-sets-num">{goalsT2}</span>
            </div>
          </div>

          {goalEvents.length > 0 && (
            <div className="sb-vball-hist sb-football-hist">
              <div className="sb-football-events-split sb-football-events-split--vball">
                <div className="sb-football-team-events left">
                  {team1Events.map((ev, idx) => {
                    const minuteLabel = ev.minute === null || ev.minute === undefined || ev.minute === '' ? 'N/A' : `${ev.minute}'`;
                    return (
                      <div key={`${ev.created_at || 'evt'}-l-${idx}`} className="sb-football-line left">
                        {ev.scorer || 'Unknown'} {minuteLabel}
                      </div>
                    );
                  })}
                </div>
                <div className="sb-football-team-events right">
                  {team2Events.map((ev, idx) => {
                    const minuteLabel = ev.minute === null || ev.minute === undefined || ev.minute === '' ? 'N/A' : `${ev.minute}'`;
                    return (
                      <div key={`${ev.created_at || 'evt'}-r-${idx}`} className="sb-football-line right">
                        {ev.scorer || 'Unknown'} {minuteLabel}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      );
    }
    case 'volleyball':
    case 'badminton':
    case 'table-tennis': {
      const isRacket = sportId === 'badminton' || sportId === 'table-tennis';
      const serverIcon = sportId === 'badminton' ? '🏸' : (sportId === 'table-tennis' ? '🏓' : '🏐');

      const pA = isRacket ? (d.current_p1 ?? 0) : (d.pointsA ?? 0);
      const pB = isRacket ? (d.current_p2 ?? 0) : (d.pointsB ?? 0);
      const sA = isRacket ? (d.games_t1 ?? 0) : (d.setsA ?? d.sets_t1 ?? 0);
      const sB = isRacket ? (d.games_t2 ?? 0) : (d.setsB ?? d.sets_t2 ?? 0);
      const curSet = isRacket ? (d.currentSet ?? ((d.past_games || []).length + 1) ?? 1) : (d.currentSet ?? 1);
      const target = isRacket
        ? (Number(d.point_limit === 'Custom' ? d.custom_limit : d.point_limit) || (sportId === 'badminton' ? 21 : 11))
        : (d.setTargets?.[curSet] ?? (curSet === 5 ? 15 : 25));
      const maxSets = isRacket
        ? (d.match_format === 'Best of 5' ? 5 : d.match_format === '1 Game' ? 1 : 3)
        : (d.max_sets ?? 5);
      const serving = isRacket ? (d.serving === 't2' ? 'B' : 'A') : (d.servingTeam ?? 'A');
      const setHistory = isRacket
        ? ((d.past_games || []).map((g) => ({
            a: Number(g.t1 || 0),
            b: Number(g.t2 || 0),
            winner: Number(g.t1 || 0) >= Number(g.t2 || 0) ? 'A' : 'B',
          })))
        : (d.setHistory || []);
      const stageLabel = isRacket ? 'GAME' : 'SET';
      const pipsCount = Math.max(1, Math.ceil(maxSets / 2));
      
      let deuceLabel = '';
      if (d.status === 'live' && pA >= target - 1 && pB >= target - 1) {
        if (pA === pB) deuceLabel = '⚡ DEUCE';
        else if (pA > pB) deuceLabel = `✨ ADV ${team1.toUpperCase()}`;
        else deuceLabel = `✨ ADV ${team2.toUpperCase()}`;
      }

      return wrap(
        <div className={`sb-vball ${compact ? 'compact' : ''}`}>
          <div className="sb-vball-top">
            <div className="sb-vball-team left">
              <span className="sb-vball-name">{team1}</span>
              <span className="sb-vball-sets-num">{sA}</span>
              <div className="sb-vball-pips">
                {[...Array(pipsCount)].map((_, i) => <div key={i} className={`sb-pip ${i < sA ? 'on' : ''}`} />)}
              </div>
              <div className={`sb-vball-serving-row ${serving !== 'A' ? 'hidden' : ''}`}>{serverIcon} SERVING</div>
            </div>

            <div className="sb-vball-center">
               <div className="sb-vball-set-lbl">{stageLabel} {curSet} OF {maxSets}</div>
               <div className="sb-vball-pts">
                 <span className="pa">{pA}</span>
                 <span className="pc">:</span>
                 <span className="pb">{pB}</span>
               </div>
               <div className="sb-vball-deuce-row" style={{ opacity: deuceLabel ? 1 : 0 }}>
                 {deuceLabel || '\u00A0'}
               </div>
            </div>

            <div className="sb-vball-team right">
              <span className="sb-vball-name">{team2}</span>
              <span className="sb-vball-sets-num">{sB}</span>
              <div className="sb-vball-pips">
                {[...Array(pipsCount)].map((_, i) => <div key={i} className={`sb-pip ${i < sB ? 'on' : ''}`} />)}
              </div>
              <div className={`sb-vball-serving-row ${serving !== 'B' ? 'hidden' : ''}`}>SERVING {serverIcon}</div>
            </div>
          </div>

          {setHistory.length > 0 && (
            <div className="sb-vball-hist">
              <span className="sb-vball-hist-lbl">{stageLabel} HISTORY</span>
              {setHistory.map((h, i) => (
                <div key={i} className="sb-vball-hist-chip">
                  {stageLabel[0]}{i+1}: {h.a}-{h.b} {h.winner === 'A' ? '(A)' : '(B)'}
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }
    case 'cricket':
      if (compact) {
        const inn = d.innings || 1;
        const curOvers = inn === 1 ? d.overs_t1 : d.overs_t2;
        const balls = (d.over_progression || '').split(' ').filter(Boolean);

        return wrap(
          <>
            <div className="sb-cricket">
              <div style={{ flex: 1 }}>
                <div className="sb-cr-label">
                  {team1}
                  {inn === 1 && <span className="sb-batting-indicator" title="Batting" />}
                </div>
                <div className="sb-cr-line">{d.runs_t1 ?? 0}/{d.wickets_t1 ?? 0}</div>
              </div>
              <div className="sb-vs">VS</div>
              <div style={{ flex: 1, textAlign: 'right' }}>
                <div className="sb-cr-label">
                  {inn === 2 && <span className="sb-batting-indicator" style={{ marginLeft: 0, marginRight: '0.5rem' }} title="Batting" />}
                  {team2}
                </div>
                <div className="sb-cr-line">{d.runs_t2 ?? 0}/{d.wickets_t2 ?? 0}</div>
              </div>
            </div>
            
            <div className="sb-rally">
              <div className="sb-cr-compact-info">
                <span className="sb-cr-inn-badge">INN {inn}</span>
                <span style={{ fontWeight: 800, color: 'var(--color-text-main)' }}>{curOvers || '0.0'} OV</span>
              </div>
              
              <div className="sb-cr-balls-list-compact">
                {balls.map((b, i) => (
                  <span 
                    key={i} 
                    className={`sb-cr-ball-compact ${b === 'W' ? 'ball-w' : (['4', '6'].includes(b) ? 'ball-boundary' : '')}`}
                  >
                    {b}
                  </span>
                ))}
                {balls.length === 0 && <span style={{ fontSize: '0.7rem', opacity: 0.4 }}>Waiting for over...</span>}
              </div>
            </div>
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
