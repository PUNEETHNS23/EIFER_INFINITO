import React, { useState } from 'react';
import CoinToss from './CoinToss';
import './LiveCricketScorer.css';

// ── Inline modal for picking who got out ────────────────────────────────────
function WicketModal({ striker, nonStriker, bowler, isFreeHit, onConfirm, onCancel }) {
  const [victim, setVictim] = useState('striker');
  const [kind, setKind] = useState(isFreeHit ? 'runout' : 'bowled');

  const dismissalLabel = {
    bowled: `b ${bowler}`,
    caught: `c & b ${bowler}`,
    lbw: `lbw b ${bowler}`,
    runout: 'run out',
    stumped: `st b ${bowler}`,
    hitwicket: `hit wicket b ${bowler}`,
    obstruct_field: 'obstructing the field',
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999
    }}>
      <div style={{
        background: 'var(--color-surface)', borderRadius: '16px',
        padding: '2rem', width: '340px', border: '1px solid var(--color-border)',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)'
      }}>
        <h3 style={{ margin: '0 0 1.5rem', color: '#ef4444', fontSize: '1.1rem' }}>⚡ Wicket!</h3>

        <div className="input-group">
          <label className="input-label">Who got out?</label>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              type="button"
              onClick={() => setVictim('striker')}
              style={{
                flex: 1, padding: '0.75rem',
                border: `2px solid ${victim === 'striker' ? '#ef4444' : 'var(--color-border)'}`,
                borderRadius: '8px', background: victim === 'striker' ? 'rgba(239,68,68,0.15)' : 'transparent',
                color: 'var(--color-text-main)', cursor: 'pointer', fontWeight: victim === 'striker' ? 'bold' : 'normal',
                transition: 'all 0.15s'
              }}
            >
              🏏 {striker || 'Striker'}
            </button>
            <button
              type="button"
              onClick={() => setVictim('nonStriker')}
              style={{
                flex: 1, padding: '0.75rem',
                border: `2px solid ${victim === 'nonStriker' ? '#ef4444' : 'var(--color-border)'}`,
                borderRadius: '8px', background: victim === 'nonStriker' ? 'rgba(239,68,68,0.15)' : 'transparent',
                color: 'var(--color-text-main)', cursor: 'pointer', fontWeight: victim === 'nonStriker' ? 'bold' : 'normal',
                transition: 'all 0.15s'
              }}
            >
              ● {nonStriker || 'Non-Striker'}
            </button>
          </div>
        </div>

        <div className="input-group" style={{ marginTop: '1rem' }}>
          <label className="input-label">Dismissal Type</label>
          <select
            className="input-field"
            value={kind}
            onChange={e => setKind(e.target.value)}
          >
            {!isFreeHit && <option value="bowled">Bowled</option>}
            {!isFreeHit && <option value="caught">Caught & Bowled</option>}
            {!isFreeHit && <option value="lbw">LBW</option>}
            <option value="runout">Run Out</option>
            {!isFreeHit && <option value="stumped">Stumped</option>}
            {!isFreeHit && <option value="hitwicket">Hit Wicket</option>}
            {isFreeHit && <option value="obstruct_field">Obstructing the field</option>}
          </select>
        </div>

        <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', margin: '0.75rem 0 1.5rem', fontStyle: 'italic' }}>
          {victim === 'striker' ? striker : nonStriker} — {dismissalLabel[kind]}
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button type="button" className="btn-outline" style={{ flex: 1 }} onClick={onCancel}>Cancel</button>
          <button
            type="button"
            className="btn-primary"
            style={{ flex: 2, background: '#ef4444', borderColor: '#ef4444' }}
            onClick={() => onConfirm(victim, dismissalLabel[kind])}
          >
            Confirm Out
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Inline modal for No Ball input ──────────────────────────────────────────
function NoBallModal({ onConfirm, onCancel }) {
  const [runs, setRuns] = useState(0);
  const [reason, setReason] = useState('Foot Fault');

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999
    }}>
      <div style={{
        background: 'var(--color-surface)', borderRadius: '16px',
        padding: '2rem', width: '340px', border: '1px solid var(--color-border)',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)'
      }}>
        <h3 style={{ margin: '0 0 1.5rem', color: '#f59e0b', fontSize: '1.1rem' }}>⚠️ No Ball</h3>

        <div className="input-group">
          <label className="input-label">Runs scored off the bat?</label>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {[0, 1, 2, 3, 4, 6].map(v => (
              <button
                key={v}
                type="button"
                onClick={() => setRuns(v)}
                style={{
                  flex: 1, minWidth: '40px', padding: '0.5rem',
                  border: `2px solid ${runs === v ? '#f59e0b' : 'var(--color-border)'}`,
                  borderRadius: '8px', background: runs === v ? 'rgba(245,158,11,0.15)' : 'transparent',
                  color: 'var(--color-text-main)', cursor: 'pointer', fontWeight: runs === v ? 'bold' : 'normal',
                }}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        <div className="input-group" style={{ marginTop: '1rem' }}>
          <label className="input-label">Reason</label>
          <select
            className="input-field"
            value={reason}
            onChange={e => setReason(e.target.value)}
          >
            <option value="Foot Fault">Foot Fault (Free Hit)</option>
            <option value="Waist High Full Toss">Waist High Full Toss (Free Hit)</option>
            <option value="Body Contact">Body Contact</option>
            <option value="Other">Other</option>
          </select>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
          <button type="button" className="btn-outline" style={{ flex: 1 }} onClick={onCancel}>Cancel</button>
          <button
            type="button"
            className="btn-primary"
            style={{ flex: 2, background: '#f59e0b', borderColor: '#f59e0b', color: '#000' }}
            onClick={() => onConfirm(runs, reason)}
          >
            Apply No Ball
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Scorer ─────────────────────────────────────────────────────────────
export default function LiveCricketScorer({ detail, patch, team1, team2, team1Data, team2Data }) {
  const [history, setHistory] = useState(() => detail.history || []);
  const [wicketModal, setWicketModal] = useState(false);
  const [nbModal, setNbModal] = useState(false);

  const isFreeHit = !!detail.is_free_hit;

  // Toss UI States
  const isMatchStarted = !!detail.toss_decided;
  const innings = Number(detail.innings || 1);

  const isTeam1BattingFirst = (detail.batting_first === team1);
  const isTeam1Batting = isTeam1BattingFirst ? (innings === 1) : (innings === 2);

  const battingPrefix = isTeam1Batting ? '_t1' : '_t2';
  const bowlingPrefix = isTeam1Batting ? '_t2' : '_t1';

  const battingTeamName = isTeam1Batting ? team1 : team2;
  const bowlingTeamName = isTeam1Batting ? team2 : team1;

  const totalRuns = detail[`runs${battingPrefix}`] || 0;
  const totalWickets = detail[`wickets${battingPrefix}`] || 0;
  const totalOvers = parseFloat(detail[`overs${battingPrefix}`] || 0);

  const battingCardKey = `batting_card${battingPrefix}`;
  const bowlingCardKey = `bowling_card${bowlingPrefix}`;

  const battingTeamData = isTeam1Batting ? team1Data : team2Data;
  const bowlingTeamData = isTeam1Batting ? team2Data : team1Data;

  let maxOvers = 20;
  if (detail.match_type === 'ODI') maxOvers = 50;
  if (detail.match_type === 'T10') maxOvers = 10;
  if (detail.match_type === 'Custom') maxOvers = detail.custom_overs || 5;
  if (detail.match_type === 'Test') maxOvers = 999;

  // ── Toss screen ─────────────────────────────────────────────────────────
  const handleToss = (tossData) => {
    const winnerName = tossData.toss_winner === 't1' ? team1 : team2;
    const decision = tossData.toss_decision === 'bat' ? 'Bat' : 'Bowl';
    
    // Derived batting order
    const batFirst = tossData.toss_winner === 't1'
      ? (decision === 'Bat' ? team1 : team2)
      : (decision === 'Bat' ? team2 : team1);

    patch({
      toss_decided: true,
      toss_winner: winnerName,
      toss_decision: decision,
      batting_first: batFirst,
      innings: 1,
      toss: `${winnerName} won the toss and elected to ${decision.toLowerCase()} first`
    });
  };

  // ── History helpers ──────────────────────────────────────────────────────
  const saveHistory = () => {
    const snapshot = { ...detail };
    delete snapshot.history; // prevent exponential nesting!
    setHistory(h => {
      const newHistory = [...h, JSON.stringify(snapshot)];
      setTimeout(() => patch({ history: newHistory }), 0);
      return newHistory;
    });
  };

  const popHistory = () => {
    if (history.length === 0) return;
    const prevStr = history[history.length - 1];
    setHistory(h => {
      const newHistory = h.slice(0, -1);
      patch({ ...JSON.parse(prevStr), history: newHistory });
      return newHistory;
    });
  };

  const getOversBalls = (oversFloat) => {
    const o = Math.floor(oversFloat);
    const b = Math.round((oversFloat - o) * 10);
    return { o, b };
  };

  // ── Swap striker / non-striker ──────────────────────────────────────────
  const swapStrike = (updates) => {
    const { striker, non_striker,
      striker_runs, striker_balls, striker_fours, striker_sixes, striker_sr,
      non_striker_runs, non_striker_balls, non_striker_fours, non_striker_sixes, non_striker_sr
    } = updates;
    updates.striker = non_striker;
    updates.striker_runs = non_striker_runs;
    updates.striker_balls = non_striker_balls;
    updates.striker_fours = non_striker_fours;
    updates.striker_sixes = non_striker_sixes;
    updates.striker_sr = non_striker_sr;
    updates.non_striker = striker;
    updates.non_striker_runs = striker_runs;
    updates.non_striker_balls = striker_balls;
    updates.non_striker_fours = striker_fours;
    updates.non_striker_sixes = striker_sixes;
    updates.non_striker_sr = striker_sr;
  };

  // ── Apply wicket (called from modal) ────────────────────────────────────
  const applyWicket = (who, dismissalStr) => {
    setWicketModal(false);
    saveHistory();
    let updates = JSON.parse(JSON.stringify(detail));
    if (!updates[battingCardKey]) updates[battingCardKey] = {};
    if (!updates[bowlingCardKey]) updates[bowlingCardKey] = {};

    const { o, b } = getOversBalls(totalOvers);

    // Wicket runs nothing for bowling/totals, just ball count
    updates[`wickets${battingPrefix}`] = totalWickets + 1;

    // Legal ball → advance overs
    let endOfOver = false;
    const nb = b + 1;
    if (nb === 6) {
      updates[`overs${battingPrefix}`] = `${o + 1}.0`;
      endOfOver = true;
    } else {
      updates[`overs${battingPrefix}`] = `${o}.${nb}`;
    }

    // Who is out?
    const victimName = who === 'striker' ? updates.striker : updates.non_striker;

    // Batter card
    if (!updates[battingCardKey][victimName]) {
      updates[battingCardKey][victimName] = { runs: 0, balls: 0, fours: 0, sixes: 0, out: false };
    }
    const bCard = updates[battingCardKey][victimName];
    bCard.balls += 1;
    bCard.out = true;
    bCard.dismissal = dismissalStr;
    bCard.sr = bCard.balls > 0 ? ((bCard.runs / bCard.balls) * 100).toFixed(2) : '0.00';

    // Clear the correct batsman slot
    if (who === 'striker') {
      updates.striker = '';
      updates.striker_runs = 0; updates.striker_balls = 0;
      updates.striker_fours = 0; updates.striker_sixes = 0; updates.striker_sr = 0;
    } else {
      // non-striker out (run-out usually) — swap so striker is cleared
      updates.non_striker = '';
      updates.non_striker_runs = 0; updates.non_striker_balls = 0;
      updates.non_striker_fours = 0; updates.non_striker_sixes = 0; updates.non_striker_sr = 0;
    }

    // Bowler card
    const bowlerName = updates.current_bowler;
    if (!updates[bowlingCardKey][bowlerName]) {
      updates[bowlingCardKey][bowlerName] = { overs: '0.0', runs: 0, wickets: 0, econ: 0 };
    }
    const bwCard = updates[bowlingCardKey][bowlerName];
    if (isFreeHit && dismissalStr.startsWith('run out') === false && dismissalStr.startsWith('obstructing') === false) {
       // Just in case
    } else {
       // Only credit bowler with wicket if not a run-out or obstructing
       if (!dismissalStr.startsWith('run out') && !dismissalStr.startsWith('obstructing')) bwCard.wickets += 1;
    }

    const { o: bo, b: bb } = getOversBalls(parseFloat(bwCard.overs));
    const nb2 = bb + 1;
    bwCard.overs = nb2 === 6 ? `${bo + 1}.0` : `${bo}.${nb2}`;
    updates.bowler_wickets = bwCard.wickets;
    updates.bowler_overs = bwCard.overs;
    const totalBalls2 = getOversBalls(parseFloat(bwCard.overs));
    const bwBalls = totalBalls2.o * 6 + totalBalls2.b;
    if (bwBalls > 0) {
      bwCard.econ = ((bwCard.runs * 6) / bwBalls).toFixed(2);
      updates.bowler_econ = bwCard.econ;
    }

    // Free hit is removed on a legal ball wicket (e.g. runout on legal ball)
    // Wait, the wicket itself advances the legal ball count (b+1). 
    // Hence, this ball was legal. Free hit should be removed.
    updates.is_free_hit = false;

    // Highlight
    updates.events_feed = `🔴 ${o}.${nb} - ${victimName} is OUT! (${dismissalStr})\n` + (updates.events_feed || '');

    // Over progression
    updates.current_ball_result = 'W';
    updates.over_progression = (updates.over_progression ? updates.over_progression + ' ' : '') + 'W';

    // End of over handling
    if (endOfOver) {
      // Save completed over before clearing
      updates.prev_over_progression = (updates.over_progression ? updates.over_progression + ' ' : '') + 'W';
      updates.events_feed = `🏁 End of Over ${o + 1} — Score: ${updates[`runs${battingPrefix}`]}/${updates[`wickets${battingPrefix}`]}
` + (updates.events_feed || '');
      updates.current_bowler = '';
      updates.over_progression = '';
      // always swap strike at end of over
      if (updates.striker && updates.non_striker) swapStrike(updates);
    }

    // Auto innings end
    if (updates[`wickets${battingPrefix}`] >= 10) {
      if (innings === 1) {
        updates.target = totalRuns + 1;
        updates.innings = 2;
        updates.striker = ''; updates.non_striker = ''; updates.current_bowler = '';
        updates.over_progression = '';
        updates.events_feed = `🛑 First Innings Ends. Target: ${updates.target}\n` + (updates.events_feed || '');
        alert('All 10 wickets down! Innings 2 begins.');
      } else {
        updates.events_feed = `🏆 MATCH OVER. ${bowlingTeamName} win!\n` + (updates.events_feed || '');
      }
    }

    patch(updates);
  };

  // ── Normal ball ──────────────────────────────────────────────────────────
  const handleBall = (type, extraData = null) => {
    if (!detail.striker || !detail.non_striker || !detail.current_bowler) {
      alert('Please select striker, non-striker, and bowler from the dropdowns first!');
      return;
    }
    // Wicket → open modal
    if (type === 'W') {
      setWicketModal(true);
      return;
    }

    saveHistory();
    let updates = JSON.parse(JSON.stringify(detail));
    if (!updates[battingCardKey]) updates[battingCardKey] = {};
    if (!updates[bowlingCardKey]) updates[bowlingCardKey] = {};

    let { o, b } = getOversBalls(totalOvers);
    let runsAdded = 0;
    let batterRuns = 0;
    let isLegal = true;
    let isExtra = false;
    let runsAreOdd = false; // determines mid-over strike rotation
    let four = 0, six = 0;

    switch (type) {
      case '0': break;
      case '1': runsAdded = 1; batterRuns = 1; runsAreOdd = true; break;
      case '2': runsAdded = 2; batterRuns = 2; break;
      case '3': runsAdded = 3; batterRuns = 3; runsAreOdd = true; break;
      case '4': runsAdded = 4; batterRuns = 4; four = 1; break;
      case '6': runsAdded = 6; batterRuns = 6; six = 1; break;
      case 'WD': runsAdded = 1; isLegal = false; isExtra = true; break;
      case 'NB': 
        const nbRuns = extraData ? extraData.runs : 0;
        runsAdded = 1 + nbRuns; 
        batterRuns = nbRuns;
        isLegal = false; 
        isExtra = true; 
        if (nbRuns % 2 !== 0) runsAreOdd = true;
        if (nbRuns === 4) four = 1;
        if (nbRuns === 6) six = 1;

        if (!updates.ball_by_ball) updates.ball_by_ball = [];
        updates.ball_by_ball.push({
          type: "no_ball",
          runs: nbRuns,
          extra: 1,
          reason: extraData ? extraData.reason : "unknown"
        });

        if (extraData && (extraData.reason === 'Foot Fault' || extraData.reason === 'Waist High Full Toss')) {
          updates.is_free_hit = true;
          updates.events_feed = `⚠️ ${o}.${b} - No Ball (${extraData.reason})! FREE HIT! ${nbRuns > 0 ? nbRuns + ' runs off bat.' : ''}\n` + (updates.events_feed || '');
        } else if (extraData) {
          updates.events_feed = `⚠️ ${o}.${b} - No Ball (${extraData.reason})! ${nbRuns > 0 ? nbRuns + ' runs off bat.' : ''}\n` + (updates.events_feed || '');
        }
        break;
      default: break;
    }

    // 1. Team Totals & Extras
    updates[`runs${battingPrefix}`] = totalRuns + runsAdded;
    if (isExtra) {
      const extKey = `extras${battingPrefix}`;
      let extraPoints = runsAdded;
      if (type === 'NB') {
        extraPoints = 1;
        const nbKey = `extras_nb${battingPrefix}`;
        updates[nbKey] = (updates[nbKey] || 0) + 1;
      } else if (type === 'WD') {
        const wdKey = `extras_wd${battingPrefix}`;
        updates[wdKey] = (updates[wdKey] || 0) + runsAdded;
      }
      updates[extKey] = (updates[extKey] || 0) + extraPoints;
    }

    // 2. Overs logic
    let endOfOver = false;
    if (isLegal) {
      updates.is_free_hit = false; // Turn off free hit after a legal ball
      b += 1;
      if (b === 6) {
        o += 1; b = 0;
        endOfOver = true;
      }
      updates[`overs${battingPrefix}`] = `${o}.${b}`;
    }

    // 3. Batter Stats
    const strikerName = updates.striker;
    if (!updates[battingCardKey][strikerName]) {
      updates[battingCardKey][strikerName] = { runs: 0, balls: 0, fours: 0, sixes: 0, out: false };
    }
    const bCard = updates[battingCardKey][strikerName];
    if (!isExtra) {
      bCard.runs += batterRuns;
      bCard.balls += 1;
      bCard.fours += four;
      bCard.sixes += six;
      bCard.sr = bCard.balls > 0 ? ((bCard.runs / bCard.balls) * 100).toFixed(2) : '0.00';
      updates.striker_runs = bCard.runs;
      updates.striker_balls = bCard.balls;
      updates.striker_fours = bCard.fours;
      updates.striker_sixes = bCard.sixes;
      updates.striker_sr = bCard.sr;
    }

    // 4. Bowler Stats
    const bowlerName = updates.current_bowler;
    if (!updates[bowlingCardKey][bowlerName]) {
      updates[bowlingCardKey][bowlerName] = { overs: '0.0', runs: 0, wickets: 0, econ: 0 };
    }
    const bwCard = updates[bowlingCardKey][bowlerName];
    if (isLegal) {
      const { o: bo, b: bb } = getOversBalls(parseFloat(bwCard.overs));
      const nb = bb + 1;
      bwCard.overs = nb === 6 ? `${bo + 1}.0` : `${bo}.${nb}`;
      updates.bowler_overs = bwCard.overs;
    }
    bwCard.runs += runsAdded;
    updates.bowler_runs = bwCard.runs;
    const tbBalls2 = getOversBalls(parseFloat(bwCard.overs));
    const bwBalls = tbBalls2.o * 6 + tbBalls2.b;
    if (bwBalls > 0) {
      bwCard.econ = ((bwCard.runs * 6) / bwBalls).toFixed(2);
      updates.bowler_econ = bwCard.econ;
    }

    // 5. Run Rate
    const matchBallsTotal = o * 6 + b;
    if (matchBallsTotal > 0) {
      updates.run_rate = ((updates[`runs${battingPrefix}`] * 6) / matchBallsTotal).toFixed(2);
    }
    if (innings === 2 && updates.target) {
      const ballsRemaining = (maxOvers * 6) - matchBallsTotal;
      updates.required_run_rate = ballsRemaining > 0
        ? (((updates.target - updates[`runs${battingPrefix}`]) * 6) / ballsRemaining).toFixed(2)
        : '0.00';
    }

    // 6. Over progression & Highlights
    // over_progression always shows current over balls (WD/NB included visually)
    // Reset it cleanly at end of over (new over starts fresh)
    const displayType = type === 'NB' && batterRuns > 0 ? `NB+${batterRuns}` : type;
    updates.current_ball_result = displayType;
    if (endOfOver) {
      // Save completed over balls so display can show them until next ball
      updates.prev_over_progression = (updates.over_progression ? updates.over_progression + ' ' : '') + displayType;
      updates.over_progression = '';
    } else {
      // Append to current over display (WD/NB show but don't count toward 6)
      updates.over_progression = (updates.over_progression ? updates.over_progression + ' ' : '') + displayType;
    }

    if (four || six) {
      const ev = four ? `hits a 4!` : `smashes a massive 6!`;
      updates.events_feed = `🔥 ${o}.${b} - ${strikerName} ${ev}\n` + (updates.events_feed || '');
    }

    // 7. Strike rotation
    // Mid-over: rotate only on odd runs
    if (!endOfOver && runsAreOdd) {
      swapStrike(updates);
    }
    // End of over: ALWAYS swap (regardless of runs on last ball)
    if (endOfOver) {
      // If the last ball was an odd-run, runsAreOdd already swapped — swap back
      // If the last ball was even/0, hasn't swapped yet — swap now
      // Net effect we always want: swap at end of over
      if (runsAreOdd) {
        // Was swapped mid-over just above, swap again to net end-of-over swap
        swapStrike(updates);
      } else {
        // Wasn't swapped, do the end-of-over swap
        swapStrike(updates);
      }

      updates.events_feed = `🏁 End of Over ${o} — Score: ${updates[`runs${battingPrefix}`]}/${updates[`wickets${battingPrefix}`]}
` + (updates.events_feed || '');
      updates.current_bowler = '';
      updates.over_progression = ''; // already reset above but keep explicit
    }

    // 8. Auto Innings Logic
    if (updates[`runs${battingPrefix}`] >= (updates.target || Infinity) && innings === 2) {
      updates.events_feed = `🏆 MATCH OVER. ${battingTeamName} chased the target!\n` + (updates.events_feed || '');
    } else if (matchBallsTotal >= maxOvers * 6) {
      if (innings === 1) {
        updates.target = updates[`runs${battingPrefix}`] + 1;
        updates.innings = 2;
        updates.striker = ''; updates.non_striker = ''; updates.current_bowler = '';
        updates.over_progression = '';
        updates.events_feed = `🛑 1st Innings Done. Target: ${updates.target}\n` + (updates.events_feed || '');
        alert(`1st Innings complete! Target: ${updates.target}. Select openers for 2nd innings.`);
      } else {
        updates.events_feed = `🏆 MATCH OVER. ${bowlingTeamName} win!\n` + (updates.events_feed || '');
      }
    }

    patch(updates);
  };

  // ── Sync helpers ─────────────────────────────────────────────────────────
  const syncPlayerStats = (slot, name) => {
    const bCard = detail[battingCardKey]?.[name];
    const stats = bCard
      ? { runs: bCard.runs, balls: bCard.balls, fours: bCard.fours, sixes: bCard.sixes, sr: bCard.sr || 0 }
      : { runs: 0, balls: 0, fours: 0, sixes: 0, sr: 0 };
    patch({
      [`${slot}`]: name,
      [`${slot}_runs`]: stats.runs,
      [`${slot}_balls`]: stats.balls,
      [`${slot}_fours`]: stats.fours,
      [`${slot}_sixes`]: stats.sixes,
      [`${slot}_sr`]: stats.sr,
    });
  };

  const syncBowlerStats = (name) => {
    const bwCard = detail[bowlingCardKey]?.[name];
    patch({
      current_bowler: name,
      bowler_overs: bwCard?.overs || '0.0',
      bowler_runs: bwCard?.runs || 0,
      bowler_wickets: bwCard?.wickets || 0,
      bowler_econ: bwCard?.econ || 0,
    });
  };

  // ── Squad list builders ──────────────────────────────────────────────────
  const buildSquadOptions = (teamData, suffix = '', battingCard = {}, excludeName = '') => {
    const squad = teamData?.squad;
    if (!squad || squad.length === 0) return (
      <>
        <option value="Batter 1">Batter 1</option>
        <option value="Batter 2">Batter 2</option>
      </>
    );
    return (
      <>
        {squad.filter(p => !p.is_substitute).map((p, i) => {
          const isOut = battingCard && battingCard[p.name]?.out === true;
          if (isOut || p.name === excludeName) return null;
          return <option key={i} value={p.name}>{p.name}{suffix}</option>;
        })}
        {squad.filter(p => p.is_substitute).map((p, i) => {
          const isOut = battingCard && battingCard[p.name]?.out === true;
          if (isOut || p.name === excludeName) return null;
          return <option key={`sub-${i}`} value={p.name}>{p.name} (Sub)</option>;
        })}
      </>
    );
  };

  const buildBowlerOptions = (teamData) => {
    const squad = teamData?.squad;
    if (!squad || squad.length === 0) return <option value="Bowler 1">Bowler 1</option>;
    return squad.map((p, i) => <option key={i} value={p.name}>{p.name}</option>);
  };

  if (!isMatchStarted) {
    return (
      <div className="lcs-container" style={{ textAlign: 'center', padding: '1rem' }}>
        <CoinToss
          sportId="cricket"
          team1Name={team1}
          team2Name={team2}
          onTossComplete={handleToss}
        />
      </div>
    );
  }

  // ── Scoring Screen ───────────────────────────────────────────────────────
  return (
    <>
      {wicketModal && (
        <WicketModal
          striker={detail.striker}
          nonStriker={detail.non_striker}
          bowler={detail.current_bowler}
          isFreeHit={isFreeHit}
          onConfirm={applyWicket}
          onCancel={() => setWicketModal(false)}
        />
      )}
      
      {nbModal && (
        <NoBallModal
          onConfirm={(runs, reason) => {
            setNbModal(false);
            handleBall('NB', { runs, reason });
          }}
          onCancel={() => setNbModal(false)}
        />
      )}

      <div className="lcs-container fade-in">
        {/* Score Header */}
        <div className="lcs-header">
          <div className="lcs-score">
            <h2 style={{ color: 'var(--color-primary)' }}>{battingTeamName} Innings</h2>
            <div className="lcs-big-score">{totalRuns}/{totalWickets}</div>
            <div className="lcs-overs">({totalOvers} ov) &nbsp;·&nbsp; Max: {maxOvers} ov</div>
            {detail.run_rate && <div style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>RR: {detail.run_rate}</div>}
          </div>
          {innings === 2 && (
            <div className="lcs-target-box slide-up">
              <div>Target: <strong>{detail.target}</strong></div>
              <div>Need: {Math.max(0, (detail.target || 0) - totalRuns)}</div>
              {detail.required_run_rate && <div style={{ fontSize: '0.8rem' }}>RRR: {detail.required_run_rate}</div>}
            </div>
          )}
        </div>

        {/* This over / Previous over */}
        {(() => {
          const hasCurrent = detail.over_progression && detail.over_progression.trim() !== '';
          const hasPrev = detail.prev_over_progression && detail.prev_over_progression.trim() !== '';
          const displayBalls = hasCurrent ? detail.over_progression : (hasPrev ? detail.prev_over_progression : null);
          const isPrev = !hasCurrent && hasPrev;
          if (!displayBalls) return null;
          const legalCount = displayBalls.split(' ').filter(b => b && b !== 'WD' && b !== 'NB').length;
          return (
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '0.4rem' }}>
                {isPrev ? `Prev Over` : 'This Over'} · {legalCount}/6 balls
                {isPrev && <span style={{ marginLeft: '0.5rem', color: '#f59e0b', fontSize: '0.7rem' }}>Waiting for new over to begin…</span>}
              </div>
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
                {displayBalls.split(' ').filter(Boolean).map((b, i) => {
                  const isExtra = b === 'WD' || b === 'NB';
                  return (
                    <span key={i} style={{
                      padding: '0.2rem 0.55rem', borderRadius: '6px', fontWeight: 'bold',
                      background: b === 'W' ? '#ef4444' : b === '6' ? '#10b981' : b === '4' ? '#3b82f6'
                        : isExtra ? '#f59e0b' : isPrev ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.12)',
                      color: '#fff',
                      outline: isExtra ? '2px dashed rgba(245,158,11,0.5)' : 'none',
                      fontSize: isExtra ? '0.75rem' : '0.85rem',
                      opacity: isPrev ? 0.75 : 1,
                    }}>{b}</span>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* Player Setup */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '0.2rem' }}>🏏 Striker</div>
            <select
              className="input-field interactive-select"
              value={detail.striker || ''}
              onChange={e => syncPlayerStats('striker', e.target.value)}
              style={{ borderColor: !detail.striker ? '#ef4444' : '' }}
            >
              <option value="">-- Striker --</option>
              {buildSquadOptions(battingTeamData, '', detail[battingCardKey] || {}, detail.non_striker)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '0.2rem' }}>● Non-Striker</div>
            <select
              className="input-field interactive-select"
              value={detail.non_striker || ''}
              onChange={e => syncPlayerStats('non_striker', e.target.value)}
              style={{ borderColor: !detail.non_striker ? '#ef4444' : '' }}
            >
              <option value="">-- Non-Striker --</option>
              {buildSquadOptions(battingTeamData, '', detail[battingCardKey] || {}, detail.striker)}
            </select>
          </div>
        </div>
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '0.2rem' }}>⚾ Bowler</div>
          <select
            className="input-field interactive-select"
            value={detail.current_bowler || ''}
            onChange={e => syncBowlerStats(e.target.value)}
            style={{ borderColor: !detail.current_bowler ? '#ef4444' : '' }}
          >
            <option value="">-- Bowler --</option>
            {buildBowlerOptions(bowlingTeamData)}
          </select>
        </div>

        {/* Mini batting stats */}
        {(detail.striker || detail.non_striker) && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '1.25rem', fontSize: '0.82rem' }}>
            {detail.striker && (
              <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '8px', padding: '0.6rem 0.8rem', borderLeft: '3px solid var(--color-primary)' }}>
                <div style={{ fontWeight: 'bold' }}>{detail.striker} 🏏</div>
                <div style={{ color: 'var(--color-text-muted)' }}>{detail.striker_runs || 0} ({detail.striker_balls || 0}b) · SR {detail.striker_sr || '0.00'}</div>
              </div>
            )}
            {detail.non_striker && (
              <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '0.6rem 0.8rem', borderLeft: '3px solid var(--color-border)' }}>
                <div style={{ fontWeight: 'bold' }}>{detail.non_striker}</div>
                <div style={{ color: 'var(--color-text-muted)' }}>{detail.non_striker_runs || 0} ({detail.non_striker_balls || 0}b)</div>
              </div>
            )}
          </div>
        )}

        {/* Keypad */}
        <div className="lcs-keypad">
          {['0','1','2','3','4','6'].map(v => (
            <button key={v} onClick={() => handleBall(v)} className={`btn-score interactive-btn ${v === '4' ? 'feature-4' : v === '6' ? 'feature-6' : ''}`}>{v}</button>
          ))}
          <button onClick={() => handleBall('WD')} className="btn-score feature-extra interactive-btn">WD</button>
          <button onClick={() => setNbModal(true)} className="btn-score feature-extra interactive-btn">NB</button>
          <button onClick={() => handleBall('W')} className="btn-score feature-wicket interactive-btn">W</button>
        </div>

        <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'flex-end' }}>
          <label style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
            <input type="checkbox" checked={isFreeHit} onChange={(e) => patch({ is_free_hit: e.target.checked })} />
            Force Free Hit (Admin Override)
          </label>
        </div>

        {/* Controls */}
        <div className="lcs-controls">
          <button onClick={popHistory} disabled={history.length === 0} className="btn-undo interactive-btn">
            ⎌ Undo ({history.length})
          </button>
          {innings === 1 && (
            <button
              onClick={() => { if (window.confirm('Force end innings?')) patch({ innings: 2, target: totalRuns + 1, striker: '', non_striker: '', current_bowler: '', over_progression: '' }); }}
              className="btn-end"
            >
              End Innings
            </button>
          )}
        </div>
      </div>
    </>
  );
}
