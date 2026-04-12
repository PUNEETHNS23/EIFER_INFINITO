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

      return wrap(
        <>
          <Row labelL={team1} labelR={team2} valL={d.goals_t1 ?? 0} valR={d.goals_t2 ?? 0} sub="GOALS" />
          {goalEvents.length > 0 && (
            <div className={`sb-football-events ${compact ? 'compact' : ''}`}>
              <div className="sb-football-events-split">
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
                <div className="sb-football-ball" aria-hidden="true">⚽</div>
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
        </>
      );
    }
    case 'volleyball': {
      // Bypass the generic Row if compact, so we always show the neon neon tech theme  

      const pA = d.pointsA ?? 0;
      const pB = d.pointsB ?? 0;
      const sA = d.setsA ?? d.sets_t1 ?? 0;
      const sB = d.setsB ?? d.sets_t2 ?? 0;
      const curSet = d.currentSet ?? 1;
      const target = d.setTargets?.[curSet] ?? (curSet === 5 ? 15 : 25);
      const maxSets = d.max_sets ?? 5;
      const serving = d.servingTeam ?? 'A';
      
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
                {[...Array(3)].map((_, i) => <div key={i} className={`sb-pip ${i < sA ? 'on' : ''}`} />)}
              </div>
              <div className={`sb-vball-serving-row ${serving !== 'A' ? 'hidden' : ''}`}>🏐 SERVING</div>
            </div>

            <div className="sb-vball-center">
               <div className="sb-vball-set-lbl">SET {curSet} OF {maxSets}</div>
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
                {[...Array(3)].map((_, i) => <div key={i} className={`sb-pip ${i < sB ? 'on' : ''}`} />)}
              </div>
              <div className={`sb-vball-serving-row ${serving !== 'B' ? 'hidden' : ''}`}>SERVING 🏐</div>
            </div>
          </div>

          {(d.setHistory || []).length > 0 && (
            <div className="sb-vball-hist">
              <span className="sb-vball-hist-lbl">SET HISTORY</span>
              {d.setHistory.map((h, i) => (
                <div key={i} className="sb-vball-hist-chip">
                  S{i+1}: {h.a}-{h.b} {h.winner === 'A' ? '(A)' : '(B)'}
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
    case 'badminton':
    case 'table-tennis': {
      const serverIcon = sportId === 'badminton' ? '🏸' : '🏓';
      if (compact) {
          return wrap(
             <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '0.5rem 0' }}>
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                 <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold' }}>
                   {team1} {d.serving === 't1' && <span style={{ fontSize: '1rem', color: 'var(--color-primary)' }}>{serverIcon}</span>}
                 </div>
                 <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                   <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Sets: {d.games_t1 ?? 0}</span>
                   <span style={{ fontSize: '1.25rem', fontWeight: 'bold', color: d.serving === 't1' ? 'var(--color-text-main)' : 'var(--color-text-muted)', minWidth: '30px', textAlign: 'right' }}>{d.current_p1 ?? 0}</span>
                 </div>
               </div>
               
               <div style={{ width: '100%', height: '1px', background: 'var(--color-border)', opacity: 0.5 }}></div>
               
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                 <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold' }}>
                   {team2} {d.serving === 't2' && <span style={{ fontSize: '1rem', color: '#ef4444' }}>{serverIcon}</span>}
                 </div>
                 <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                   <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Sets: {d.games_t2 ?? 0}</span>
                   <span style={{ fontSize: '1.25rem', fontWeight: 'bold', color: d.serving === 't2' ? 'var(--color-text-main)' : 'var(--color-text-muted)', minWidth: '30px', textAlign: 'right' }}>{d.current_p2 ?? 0}</span>
                 </div>
               </div>
             </div>
          );
      }

      return wrap(
        <div className="sb-badminton-premium">
          <div className="sb-cricket-header-row">
             <span className="cricket-status-badge">{match.status.toUpperCase()}</span>
             <span className="cricket-toss" style={{ fontSize: '0.85rem' }}>{d.toss || 'Pre-match setup pending'}</span>
             <span className="cricket-toss" style={{ fontSize: '0.85rem', color: 'var(--color-primary)' }}>{d.match_format || 'Best of 3'}</span>
          </div>

          <div style={{ display: 'flex', marginTop: '1rem', paddingBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            
            {/* PAST GAMES */}
            <div style={{ display: 'flex', gap: '0.5rem', paddingRight: '1rem', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
              {(d.past_games || []).map((g, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.03)', padding: '0.5rem', borderRadius: '4px', minWidth: '40px' }}>
                   <div style={{ fontSize: '0.9rem', color: g.t1 > g.t2 ? 'var(--color-primary)' : 'var(--color-text-muted)' }}>{g.t1}</div>
                   <div style={{ width: '100%', height: '1px', background: 'var(--color-border)', margin: '4px 0'}}></div>
                   <div style={{ fontSize: '0.9rem', color: g.t2 > g.t1 ? '#ef4444' : 'var(--color-text-muted)' }}>{g.t2}</div>
                </div>
              ))}
              {(d.past_games || []).length === 0 && (
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>Set Scores</div>
              )}
            </div>

            {/* LIVE POINTS / MAIN CONTENT */}
            <div style={{ flex: 1, display: 'flex', paddingLeft: '1.5rem', justifyContent: 'center', alignItems: 'center', gap: '2rem' }}>
               
               <div style={{ textAlign: 'right', minWidth: '120px' }}>
                  <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '0.2rem' }}>{d.p1_name || 'Player 1'}</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 'bold', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.5rem' }}>
                    <span>{team1}</span>
                    {d.serving === 't1' && <span style={{ fontSize: '1.2rem', color: 'var(--color-primary)' }}>{serverIcon}</span>}
                  </div>
                  <div style={{ fontSize: '0.9rem', color: 'var(--color-primary)', marginTop: '0.2rem' }}>Games: {d.games_t1 ?? 0}</div>
               </div>

               <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  <div style={{ fontSize: '3.5rem', fontWeight: 900, lineHeight: 1, color: d.serving === 't1' ? 'var(--color-text-main)' : 'var(--color-text-muted)' }}>{d.current_p1 ?? 0}</div>
                  <div style={{ fontSize: '1.5rem', opacity: 0.3 }}>-</div>
                  <div style={{ fontSize: '3.5rem', fontWeight: 900, lineHeight: 1, color: d.serving === 't2' ? 'var(--color-text-main)' : 'var(--color-text-muted)' }}>{d.current_p2 ?? 0}</div>
               </div>

               <div style={{ textAlign: 'left', minWidth: '120px' }}>
                  <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '0.2rem' }}>{d.p2_name || 'Player 1'}</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {d.serving === 't2' && <span style={{ fontSize: '1.2rem', color: '#ef4444' }}>{serverIcon}</span>}
                    <span>{team2}</span>
                  </div>
                  <div style={{ fontSize: '0.9rem', color: '#ef4444', marginTop: '0.2rem' }}>Games: {d.games_t2 ?? 0}</div>
               </div>

            </div>
          </div>
        </div>
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
