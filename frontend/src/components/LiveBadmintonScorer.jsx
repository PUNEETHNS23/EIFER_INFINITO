import React, { useState } from 'react';
import './LiveCricketScorer.css'; // Just re-use the cool buttons and structure

export default function LiveBadmintonScorer({ sid, detail, patch, team1, team2, team1Data, team2Data }) {
  const [history, setHistory] = useState([]);
  
  // Toss UI States
  const [tossWinner, setTossWinner] = useState(team1);
  const [tossDecision, setTossDecision] = useState('Serve');
  const [matchFormat, setMatchFormat] = useState('Best of 3');

  const isMatchStarted = !!detail.toss_decided;

  const saveHistory = () => setHistory(h => [...h, JSON.stringify(detail)]);

  const popHistory = () => {
    if (history.length === 0) return;
    patch(JSON.parse(history[history.length - 1]));
    setHistory(h => h.slice(0, -1));
  };

  const handleStartMatch = () => {
    patch({
      toss_decided: true,
      toss_winner: tossWinner,
      toss_decision: tossDecision,
      serving: tossWinner === team1 ? (tossDecision === 'Serve' ? 't1' : 't2') : (tossDecision === 'Serve' ? 't2' : 't1'),
      match_format: matchFormat,
      toss: `${tossWinner} won the toss and elected to ${tossDecision.toLowerCase()} first`
    });
  };

  const handlePoint = (team) => {
    saveHistory();
    let updates = JSON.parse(JSON.stringify(detail));
    
    if (team === 't1') {
      updates.current_p1 += 1;
      updates.serving = 't1';
    } else {
      updates.current_p2 += 1;
      updates.serving = 't2';
    }

    const limit = parseInt(updates.point_limit === 'Custom' ? updates.custom_limit : updates.point_limit) || (sid === 'badminton' ? 21 : 11);
    if (updates.current_p1 >= limit || updates.current_p2 >= limit) {
      if (Math.abs(updates.current_p1 - updates.current_p2) >= 2 || Math.max(updates.current_p1, updates.current_p2) >= 30) {
        // Just an alert to notify limit reached, wait for manual End Game click
        if ((team === 't1' && updates.current_p1 === limit) || (team === 't2' && updates.current_p2 === limit)) {
           // We only alert exactly when it hits the limit so it doesn't spam every subsequent point
           alert(`Game limit reached! You can keep scoring or manually End Game.`);
        }
      }
    }
    patch(updates);
  };

  const handleEndGame = () => {
    if (!window.confirm('Are you sure you want to end this game/set?')) return;
    saveHistory();
    let updates = JSON.parse(JSON.stringify(detail));
    
    // Save history
    updates.past_games = updates.past_games || [];
    updates.past_games.push({ t1: updates.current_p1, t2: updates.current_p2 });

    // Tally Set
    if (updates.current_p1 > updates.current_p2) {
      updates.games_t1 += 1;
    } else if (updates.current_p2 > updates.current_p1) {
      updates.games_t2 += 1;
    }

    // Reset points
    updates.current_p1 = 0;
    updates.current_p2 = 0;

    patch(updates);

    // Check Match Win
    const limit = matchFormat === 'Best of 5' ? 3 : 2;
    if (updates.games_t1 >= limit) alert(`Match over! ${team1} wins the match.`);
    if (updates.games_t2 >= limit) alert(`Match over! ${team2} wins the match.`);
  };

  const buildSquadOptions = (teamData) => {
    const squad = teamData?.squad;
    if (!squad || squad.length === 0) return <>
        <option value="Player 1">Player 1</option>
        <option value="Player 2">Player 2</option>
    </>;
    return squad.map((p, i) => <option key={i} value={p.name}>{p.name}</option>);
  };

  if (!isMatchStarted) {
    return (
      <div className="lcs-container" style={{ textAlign: 'center', padding: '2rem' }}>
        <h2 style={{ marginBottom: '1rem', color: 'var(--color-primary)' }}>Pre-Match: Setup</h2>
        <div style={{ margin: '1.5rem 0', display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
          
          <div className="input-group" style={{ width: '100%', maxWidth: '300px', textAlign: 'left' }}>
            <label className="input-label">Initial Point Limit</label>
            <select className="input-field" value={detail.point_limit === 'Custom' ? 'Custom' : (detail.point_limit || (sid === 'badminton' ? '21' : '11'))} onChange={e => patch({point_limit: e.target.value})}>
              {sid === 'badminton' && <option value="21">21 Points (Standard)</option>}
              {sid === 'table-tennis' && <option value="11">11 Points (Standard)</option>}
              <option value="15">15 Points</option>
              <option value="25">25 Points</option>
              <option value="Custom">Custom</option>
            </select>
          </div>

          {detail.point_limit === 'Custom' && (
            <div className="input-group" style={{ width: '100%', maxWidth: '300px', textAlign: 'left' }}>
              <label className="input-label">Custom Limit</label>
              <input className="input-field" type="number" placeholder="Enter Custom Limit" value={detail.custom_limit || "21"} onChange={(e) => patch({custom_limit: e.target.value})} />
            </div>
          )}

          <div className="input-group" style={{ width: '100%', maxWidth: '300px', textAlign: 'left' }}>
            <label className="input-label">Match Format</label>
            <select className="input-field" value={matchFormat} onChange={e => setMatchFormat(e.target.value)}>
              <option value="Best of 3">Best of 3 Games</option>
              <option value="Best of 5">Best of 5 Games</option>
              <option value="1 Game">1 Game Only</option>
            </select>
          </div>

          <hr style={{ width: '100%', maxWidth: '300px', borderColor: 'var(--color-border)', margin: '1rem 0' }}/>

          <div className="input-group" style={{ width: '100%', maxWidth: '300px', textAlign: 'left' }}>
            <label className="input-label">Who won the Toss?</label>
            <select className="input-field" value={tossWinner} onChange={e => setTossWinner(e.target.value)}>
              <option value={team1}>{team1}</option>
              <option value={team2}>{team2}</option>
            </select>
          </div>
          <div className="input-group" style={{ width: '100%', maxWidth: '300px', textAlign: 'left' }}>
            <label className="input-label">Decision?</label>
            <select className="input-field" value={tossDecision} onChange={e => setTossDecision(e.target.value)}>
              <option value="Serve">Serve First</option>
              <option value="Receive">Receive First</option>
            </select>
          </div>
        </div>
        <button className="btn-primary interactive-btn" onClick={handleStartMatch}>▶ Start Match</button>
      </div>
    );
  }

  return (
    <div className="lcs-container fade-in">
      {/* Player Lineup */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '1.5rem' }}>
        <div>
           <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '0.2rem' }}>{team1} Player 1</div>
           <select className="input-field" value={detail.p1_name || ''} onChange={e => patch({p1_name: e.target.value})}>
              <option value="">-- Select --</option>
              {buildSquadOptions(team1Data)}
           </select>
        </div>
        <div>
           <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '0.2rem' }}>{team2} Player 1</div>
           <select className="input-field" value={detail.p2_name || ''} onChange={e => patch({p2_name: e.target.value})}>
              <option value="">-- Select --</option>
              {buildSquadOptions(team2Data)}
           </select>
        </div>
      </div>

      {/* Main Scoreboard Editor View */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '12px', marginBottom: '1.25rem' }}>
        
        {/* TEAM 1 */}
        <div style={{ textAlign: 'center', flex: 1 }}>
          <div style={{ fontWeight: 'bold', fontSize: '1.2rem', color: detail.serving === 't1' ? '#10b981' : 'var(--color-text-main)' }}>
             {team1} {detail.serving === 't1' && '🏸'}
          </div>
          <div style={{ fontSize: '3rem', fontWeight: 900, textShadow: '0 0 20px rgba(255,255,255,0.1)' }}>{detail.current_p1}</div>
          <div style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>Games: {detail.games_t1}</div>
          <button onClick={() => handlePoint('t1')} className="btn-score interactive-btn" style={{ width: '100%', marginTop: '1rem', background: '#3b82f6', color: '#fff' }}>+1 Point</button>
        </div>

        <div style={{ padding: '0 1rem', fontSize: '1.5rem', color: 'var(--color-text-muted)', opacity: 0.5 }}>VS</div>

        {/* TEAM 2 */}
        <div style={{ textAlign: 'center', flex: 1 }}>
          <div style={{ fontWeight: 'bold', fontSize: '1.2rem', color: detail.serving === 't2' ? '#10b981' : 'var(--color-text-main)' }}>
             {detail.serving === 't2' && '🏸'} {team2}
          </div>
          <div style={{ fontSize: '3rem', fontWeight: 900, textShadow: '0 0 20px rgba(255,255,255,0.1)' }}>{detail.current_p2}</div>
          <div style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>Games: {detail.games_t2}</div>
          <button onClick={() => handlePoint('t2')} className="btn-score interactive-btn" style={{ width: '100%', marginTop: '1rem', background: '#ef4444', color: '#fff' }}>+1 Point</button>
        </div>

      </div>



      {/* Controls */}
      <div className="lcs-controls">
        <button onClick={popHistory} disabled={history.length === 0} className="btn-undo interactive-btn">
          ⎌ Undo ({history.length})
        </button>
        <button onClick={handleEndGame} className="btn-end">
          End Game (Set)
        </button>
      </div>

    </div>
  );
}
