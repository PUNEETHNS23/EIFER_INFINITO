import React, { useState, useEffect } from 'react';
import { getSportMeta } from '../sports/sportsConfig';
import api from '../api';
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

function getPlayerNames(teamData) {
  const squad = Array.isArray(teamData?.squad) ? teamData.squad : [];
  return squad.map((player) => player?.name).filter(Boolean);
}

/**
 * Public scoreboard for a match (read-only).
 */
export default function SportScoreboard({ match, compact = false, team1Data = null, team2Data = null }) {
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
      const period = d.period || '1st Half';
      const displayPeriod = match.status === 'completed' ? 'Full-Time' : period;

      const eventTypeMap = {
        goal: '',
        penalty: 'P',
        own_goal: 'OG',
        yellow_card: 'YC',
        red_card: 'RC',
      };

      return wrap(
        <div className={`sb-vball sb-football-vball ${compact ? 'compact' : ''}`}>
          <div className="sb-vball-top">
            <div className="sb-vball-team left">
              <span className="sb-vball-name">{team1}</span>
              <span className="sb-vball-sets-num">{goalsT1}</span>
            </div>

            <div className="sb-vball-center">
              <div className="sb-vball-set-lbl">GOALS</div>
              <div className="sb-football-period">{displayPeriod}</div>
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
                    const tagText = eventTypeMap[ev.type] || '';
                    return (
                      <div key={`${ev.created_at || 'evt'}-l-${idx}`} className="sb-football-line left">
                        <span className="sb-football-event-info">
                          {ev.scorer || 'Unknown'} {tagText && <span className={`sb-football-event-tag sb-football-event-tag--${ev.type}`}>{tagText}</span>}
                        </span>
                        <span className="sb-football-event-minute">{minuteLabel}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="sb-football-team-events right">
                  {team2Events.map((ev, idx) => {
                    const minuteLabel = ev.minute === null || ev.minute === undefined || ev.minute === '' ? 'N/A' : `${ev.minute}'`;
                    const tagText = eventTypeMap[ev.type] || '';
                    return (
                      <div key={`${ev.created_at || 'evt'}-r-${idx}`} className="sb-football-line right">
                        <span className="sb-football-event-minute">{minuteLabel}</span>
                        <span className="sb-football-event-info">
                          {tagText && <span className={`sb-football-event-tag sb-football-event-tag--${ev.type}`}>{tagText}</span>} {ev.scorer || 'Unknown'}
                        </span>
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
                {d.is_free_hit && <span style={{ background: '#f59e0b', color: '#000', padding: '2px 6px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 800, marginLeft: '0.5rem' }}>FREE HIT</span>}
                <span style={{ fontWeight: 800, color: 'var(--color-text-main)', marginLeft: 'auto' }}>{curOvers || '0.0'} OV</span>
              </div>
              
              <div className="sb-cr-balls-list-compact">
                {balls.map((b, i) => (
                  <span 
                    key={i} 
                    className={`sb-cr-ball-compact ${b.includes('W') && !b.includes('WD') ? 'ball-w' : (b.includes('4') || b.includes('6') ? 'ball-boundary' : '')}`}
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
             <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
               {d.is_free_hit && <span style={{ background: '#f59e0b', color: '#000', padding: '2px 6px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 800 }}>FREE HIT</span>}
               Last Ball: {d.current_ball_result || '-'}
             </span>
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
                   <span key={i} className={`cricket-ball-circle ${b.includes('W') && !b.includes('WD') ? 'ball-w' : (b.includes('4') || b.includes('6') ? 'ball-boundary' : 'ball-normal')}`}>{b}</span>
                ))}
             </div>
          </div>
        </div>
      );
    case 'carrom':
      return wrap(
        <div className={`sb-carrom ${compact ? 'sb-carrom-compact' : ''}`}>
          {match.status !== 'completed' ? (
            <>
              <div className="sb-carrom-header">
                <span className="sb-carrom-status">{match.status === 'live' ? 'Live match' : 'Scheduled match'}</span>
                <span className="sb-carrom-sub">
                  {d.category || 'Singles'} • Final score will appear after completion
                </span>
              </div>
              <div className="sb-carrom-dim">
                <div>
                  <div className="sb-name">{team1}</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
                    Strikes: <span style={{ fontWeight: 'bold', textTransform: 'capitalize' }}>{d.color_assignment?.t1 || 'black'}</span>
                  </div>
                  {getPlayerNames(team1Data).length > 0 && (
                    <div className="sb-carrom-note">Players: {getPlayerNames(team1Data).join(', ')}</div>
                  )}
                </div>
                <div className="sb-carrom-vs">VS</div>
                <div style={{ textAlign: 'right' }}>
                  <div className="sb-name">{team2}</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
                    Strikes: <span style={{ fontWeight: 'bold', textTransform: 'capitalize' }}>{d.color_assignment?.t2 || 'white'}</span>
                  </div>
                  {getPlayerNames(team2Data).length > 0 && (
                    <div className="sb-carrom-note">Players: {getPlayerNames(team2Data).join(', ')}</div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="sb-carrom-header">
                <span className="sb-carrom-status final">FULL TIME</span>
                <span className="sb-carrom-sub">
                  {d.category || 'Singles'} •{' '}
                  {new Date(match.scheduled_time).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div className="sb-carrom-final-grid">
                <div className="sb-carrom-side left">
                  <div className="sb-name">{team1}</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                    <span style={{ textTransform: 'capitalize' }}>{d.color_assignment?.t1 || 'black'}</span> coins
                  </div>
                  <div className="sb-carrom-score">{d.points_t1 ?? match.score_t1 ?? 0}</div>
                  {getPlayerNames(team1Data).length > 0 && (
                    <div className="sb-carrom-note">Players: {getPlayerNames(team1Data).join(', ')}</div>
                  )}
                </div>
                <div className="sb-carrom-middle">
                  <div className="sb-carrom-winner-label">Winner</div>
                  <div className="sb-carrom-winner">
                    {(match.score_t1 ?? d.points_t1 ?? 0) > (match.score_t2 ?? d.points_t2 ?? 0)
                      ? team1
                      : (match.score_t2 ?? d.points_t2 ?? 0) > (match.score_t1 ?? d.points_t1 ?? 0)
                        ? team2
                        : 'Draw'}
                  </div>
                </div>
                <div className="sb-carrom-side right">
                  <div className="sb-name">{team2}</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                    <span style={{ textTransform: 'capitalize' }}>{d.color_assignment?.t2 || 'white'}</span> coins
                  </div>
                  <div className="sb-carrom-score">{d.points_t2 ?? match.score_t2 ?? 0}</div>
                  {getPlayerNames(team2Data).length > 0 && (
                    <div className="sb-carrom-note">Players: {getPlayerNames(team2Data).join(', ')}</div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      );
    case 'kho-kho': {
      const isCompleted = match.status === 'completed';
      const w = (d.winner || '').toLowerCase();
      const winnerName = w === 't1' ? team1 : (w === 't2' ? team2 : (w === 'draw' ? 'Draw' : 'TBD'));
      
      return wrap(
        <div className="sb-carrom sb-tugwar-card">
          <div className="sb-carrom-header">
            <span className={`sb-carrom-status ${isCompleted ? 'final' : ''}`}>
              {isCompleted ? 'FULL TIME' : (match.status === 'live' ? 'LIVE' : 'SCHEDULED')}
            </span>
            <span className="sb-carrom-sub">
              {isCompleted ? (`Time: ${d.minutes || 0} min ${d.seconds || 0} sec`) : 'Result will be published after completion'}
            </span>
          </div>
          {isCompleted ? (
            <div className="sb-carrom-final-grid" style={{ display: 'flex', alignItems: 'center' }}>
              <div className="sb-carrom-side left" style={{ flex: 1, textAlign: 'left', padding: '1rem' }}>
                <div className="sb-name">{team1}</div>
                <div className="sb-carrom-vs" style={{ margin: '0.5rem 0' }}>VS</div>
                <div className="sb-name">{team2}</div>
              </div>
              <div className="sb-carrom-middle" style={{ flex: 1, padding: '1rem', borderLeft: '1px solid rgba(255,255,255,0.1)' }}>
                <div className="sb-carrom-winner-label">Winner</div>
                <div className="sb-carrom-winner">{winnerName}</div>
              </div>
            </div>
          ) : (
            <div className="sb-carrom-dim">
              <div>
                <div className="sb-name">{team1}</div>
              </div>
              <div className="sb-carrom-vs">VS</div>
              <div style={{ textAlign: 'right' }}>
                <div className="sb-name">{team2}</div>
              </div>
            </div>
          )}
        </div>
      );
    }
    case 'chess': {
      const w = (d.winner || 'draw').toLowerCase();
      const isTeam1Winner = w === 't1';
      const isTeam2Winner = w === 't2';
      const isDraw = !isTeam1Winner && !isTeam2Winner;
      const line = isDraw ? 'Match Drawn' : `${isTeam1Winner ? team1 : team2} wins`;
      const liveLikeStatus = match.status === 'live' ? 'Live match' : 'Scheduled match';

      if (match.status !== 'completed') {
        return wrap(
          <div className="sb-carrom sb-tugwar-card">
            <div className="sb-carrom-header">
              <span className="sb-carrom-status">{liveLikeStatus}</span>
              <span className="sb-carrom-sub">Final result will be published after completion</span>
            </div>
            <div className="sb-carrom-dim">
              <div>
                <div className="sb-name">{team1}</div>
              </div>
              <div className="sb-carrom-vs">VS</div>
              <div style={{ textAlign: 'right' }}>
                <div className="sb-name">{team2}</div>
              </div>
            </div>
          </div>
        );
      }

      return wrap(
        <div className="sb-chess">
          <div className="sb-chess-final-grid">
            <div className={`sb-chess-team left ${isTeam1Winner ? 'winner' : ''}`}>
              <span className="sb-name">{team1}</span>
              {isTeam1Winner && <span className="sb-chess-badge">Winner</span>}
            </div>
            <div className="sb-chess-vs">VS</div>
            <div className={`sb-chess-team right ${isTeam2Winner ? 'winner' : ''}`}>
              <span className="sb-name">{team2}</span>
              {isTeam2Winner && <span className="sb-chess-badge">Winner</span>}
            </div>
          </div>
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
    case 'weight-lifting': {
      const valL = d.injured_t1 ? 'INJURED' : `${d.kg_t1 ?? 0} kg`;
      const valR = d.injured_t2 ? 'INJURED' : `${d.kg_t2 ?? 0} kg`;
      return wrap(
        <Row labelL={team1} labelR={team2} valL={valL} valR={valR} sub="BEST LIFT" />
      );
    }
    case 'arm-wrestling':
    case 'tug-of-war':
      if (sportId === 'tug-of-war') {
        const roundsT1 = Number(d.rounds_t1 ?? 0);
        const roundsT2 = Number(d.rounds_t2 ?? 0);
        const format = d.match_format || 'Best of 3';
        const roundsToWin = format === 'Best of 5' ? 3 : format === '1 Game' ? 1 : format === 'Custom' ? Number(d.custom_rounds || 2) : 2;
        const winner = match.status === 'completed'
          ? (roundsT1 > roundsT2 ? team1 : roundsT2 > roundsT1 ? team2 : 'Draw')
          : 'TBD';

        return wrap(
          <div className="sb-carrom sb-tugwar-card">
            <div className="sb-carrom-header">
              <span className={`sb-carrom-status ${match.status === 'completed' ? 'final' : ''}`}>
                {match.status === 'completed' ? 'FULL TIME' : (match.status === 'live' ? 'LIVE' : 'SCHEDULED')}
              </span>
              <span className="sb-carrom-sub">{format === 'Custom' ? `Custom - first to ${roundsToWin}` : format}</span>
            </div>
            {match.status === 'completed' ? (
              <div className="sb-carrom-final-grid">
                <div className="sb-carrom-side left">
                  <div className="sb-name">{team1}</div>
                  <div className="sb-carrom-score">{roundsT1}</div>
                </div>
                <div className="sb-carrom-middle">
                  <div className="sb-carrom-winner-label">Winner</div>
                  <div className="sb-carrom-winner">{winner}</div>
                </div>
                <div className="sb-carrom-side right">
                  <div className="sb-name">{team2}</div>
                  <div className="sb-carrom-score">{roundsT2}</div>
                </div>
              </div>
            ) : (
              <div className="sb-carrom-dim">
                <div>
                  <div className="sb-name">{team1}</div>
                  <div className="sb-carrom-note">Rounds won: {roundsT1}</div>
                </div>
                <div className="sb-carrom-vs">VS</div>
                <div style={{ textAlign: 'right' }}>
                  <div className="sb-name">{team2}</div>
                  <div className="sb-carrom-note">Rounds won: {roundsT2}</div>
                </div>
              </div>
            )}
          </div>
        );
      }
      return wrap(
        <Row
          labelL={team1}
          labelR={team2}
          valL={d.rounds_t1 ?? 0}
          valR={d.rounds_t2 ?? 0}
          sub="ROUNDS WON"
        />
      );
    case 'esports':
      return wrap(<Row labelL={team1} labelR={team2} valL={d.maps_t1 ?? 0} valR={d.maps_t2 ?? 0} sub="MAPS WON" />);
    case 'athletics': {
      const [teams, setTeams] = useState([]);
      useEffect(() => { api.get('/teams').then(res => setTeams(res.data)); }, []);

      const eventLabels = { boys_100m: 'Boys 100m', girls_100m: 'Girls 100m', relay_4x100: '4 × 100m Relay' };
      const eventLabel = eventLabels[d.event_type] || d.event_type || 'Event';
      const qualifierCount = d.qualifier_count || null;
      const participants = d.participants || [];
      const isFinalMatch = !!d.is_final;
      const hasResults = participants.some(p => p.rank);

      const sortedParticipants = [...participants].sort((a, b) => {
        if (!a.rank && !b.rank) return 0;
        if (!a.rank) return 1;
        if (!b.rank) return -1;
        return a.rank - b.rank;
      });

      const displayList = compact ? sortedParticipants.slice(0, 3) : sortedParticipants;

      return wrap(
        <div className="sb-carrom" style={{ padding: '0.5rem 0' }}>
          {/* Header Row: Event name + badges */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{eventLabel}</span>
            {isFinalMatch && (
              <span style={{ fontSize: '0.7rem', fontWeight: 800, background: '#fbbf24', color: '#000', padding: '2px 7px', borderRadius: '4px', letterSpacing: '0.06em' }}>FINAL</span>
            )}
            <span className={`sb-carrom-status ${status === 'completed' ? 'final' : ''}`} style={{ marginLeft: 'auto', fontSize: '0.72rem' }}>
              {status === 'completed' ? 'COMPLETED' : 'UPCOMING'}
            </span>
          </div>

          {/* Qualifier note */}
          {qualifierCount && (
            <div style={{ fontSize: '0.75rem', color: '#34d399', marginBottom: '0.6rem' }}>
              ✅ Top {qualifierCount} team{qualifierCount !== 1 ? 's' : ''} qualified from this match
            </div>
          )}

          {/* Participants list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            {displayList.map((p) => {
              const teamName = teams.find(t => String(t.id) === String(p.team_id))?.name || `Team ${p.team_id}`;
              const rankColor = p.rank === 1 ? '#fbbf24' : p.rank === 2 ? '#94a3b8' : p.rank === 3 ? '#cd7f32' : 'rgba(255,255,255,0.25)';
              const statusEl = hasResults
                ? p.qualified
                  ? <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#34d399', background: 'rgba(52,211,153,0.12)', padding: '2px 6px', borderRadius: '4px' }}>Qualified ✅</span>
                  : <span style={{ fontSize: '0.68rem', fontWeight: 600, color: '#f87171', background: 'rgba(248,113,113,0.1)', padding: '2px 6px', borderRadius: '4px' }}>Eliminated ❌</span>
                : null;
              return (
                <div key={p.team_id} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.35rem 0.6rem', background: p.qualified ? 'rgba(52,211,153,0.04)' : 'rgba(255,255,255,0.02)', borderRadius: '6px', border: `1px solid ${p.qualified ? 'rgba(52,211,153,0.15)' : 'rgba(255,255,255,0.05)'}` }}>
                  {/* Rank badge */}
                  <div style={{ width: '22px', height: '22px', background: rankColor, color: p.rank <= 3 ? '#000' : 'var(--color-text-muted)', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 800, flexShrink: 0 }}>
                    {p.rank || '—'}
                  </div>
                  <span style={{ fontSize: '0.88rem', fontWeight: 500, flex: 1 }}>{teamName}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    {p.time > 0 && <span style={{ fontSize: '0.78rem', color: 'var(--color-primary)', fontFamily: 'monospace' }}>{Number(p.time).toFixed(3)}s</span>}
                    {statusEl}
                  </div>
                </div>
              );
            })}
            {compact && participants.length > 3 && (
              <div style={{ textAlign: 'center', fontSize: '0.73rem', color: 'var(--color-text-muted)', marginTop: '0.15rem' }}>
                + {participants.length - 3} more participants
              </div>
            )}
            {participants.length === 0 && (
              <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', margin: 0 }}>No participants yet.</p>
            )}
          </div>
        </div>
      );
    }
    default:
      return wrap(
        <Row labelL={team1} labelR={team2} valL={d.score_t1 ?? match.score_t1} valR={d.score_t2 ?? match.score_t2} sub="SCORE" />
      );
  }
}
