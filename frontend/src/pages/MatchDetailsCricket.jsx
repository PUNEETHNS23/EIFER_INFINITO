import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api';
import { useMatchSocket } from '../hooks/useMatchSocket';
import SportScoreboard from '../components/SportScoreboard';
import './MatchDetails.css';

function ScorecardInnings({ title, battingCard, bowlingCard, strikerName, nonStrikerName, currentBowler, totalRuns, totalWickets, extras = 0 }) {
  const rows = Object.entries(battingCard || {});
  return (
    <div className="scorecard-section">
      <h3 className="scorecard-title">
        {title}
      </h3>

      {/* Batting Table */}
      <div className="table-responsive">
        <table className="leaderboard-table">
          <thead>
            <tr>
              <th>Batter</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>R</th>
              <th style={{ textAlign: 'right' }}>B</th>
              <th style={{ textAlign: 'right' }}>4s</th>
              <th style={{ textAlign: 'right' }}>6s</th>
              <th style={{ textAlign: 'right' }}>SR</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([name, stats]) => {
              const isAtCrease = name === strikerName || name === nonStrikerName;
              return (
                <tr key={name} style={{ background: isAtCrease ? 'rgba(255,255,255,0.03)' : 'transparent' }}>
                  <td style={{ fontWeight: isAtCrease ? 'bold' : 'normal' }}>
                    {name} {name === strikerName ? '🏏' : isAtCrease ? '●' : ''}
                  </td>
                  <td style={{ color: stats.out ? '#ef4444' : '#10b981', fontSize: '0.82rem' }}>
                    {stats.out ? stats.dismissal || 'out' : 'not out'}
                  </td>
                  <td style={{ fontWeight: 'bold', textAlign: 'right' }}>{stats.runs}</td>
                  <td style={{ textAlign: 'right' }}>{stats.balls}</td>
                  <td style={{ textAlign: 'right', color: stats.fours > 0 ? '#3b82f6' : 'inherit' }}>{stats.fours}</td>
                  <td style={{ textAlign: 'right', color: stats.sixes > 0 ? '#10b981' : 'inherit' }}>{stats.sixes}</td>
                  <td style={{ textAlign: 'right', fontSize: '0.85rem' }}>{stats.sr || '0.00'}</td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={7} style={{ padding: '1rem', color: 'var(--color-text-muted)', textAlign: 'center' }}>Innings not started</td></tr>
            )}
          </tbody>
          <tfoot>
            <tr style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
              <td colSpan={2}>Extras</td>
              <td style={{ textAlign: 'right' }} colSpan={5}>{extras}</td>
            </tr>
            <tr style={{ fontWeight: 'bold' }}>
              <td colSpan={2}>Total</td>
              <td className="points-cell" style={{ textAlign: 'right', fontSize: '1rem' }} colSpan={5}>
                {totalRuns}/{totalWickets}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Bowling Table  */}
      {Object.keys(bowlingCard || {}).length > 0 && (
        <div className="table-responsive" style={{ marginTop: '1rem' }}>
          <table className="leaderboard-table">
            <thead>
              <tr>
                <th>Bowler</th>
                <th style={{ textAlign: 'right' }}>O</th>
                <th style={{ textAlign: 'right' }}>R</th>
                <th style={{ textAlign: 'right' }}>W</th>
                <th style={{ textAlign: 'right' }}>ECON</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(bowlingCard).map(([name, stats]) => (
                <tr key={name} style={{ background: name === currentBowler ? 'rgba(255,255,255,0.03)' : 'transparent' }}>
                  <td style={{ fontWeight: name === currentBowler ? 'bold' : 'normal' }}>
                    {name} {name === currentBowler ? '⚾' : ''}
                  </td>
                  <td style={{ textAlign: 'right' }}>{stats.overs}</td>
                  <td style={{ textAlign: 'right' }}>{stats.runs}</td>
                  <td style={{ fontWeight: 'bold', textAlign: 'right', color: stats.wickets > 0 ? '#ef4444' : 'inherit' }}>{stats.wickets}</td>
                  <td style={{ textAlign: 'right', fontSize: '0.85rem' }}>{stats.econ || '0.00'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function MatchDetailsCricket() {
  const { id } = useParams();
  const [match, setMatch] = useState(null);
  const [team1Data, setTeam1Data] = useState(null);
  const [team2Data, setTeam2Data] = useState(null);
  const [activeTab, setActiveTab] = useState('live');
  const prevScoreRef = useRef(null);
  const [scoreFlash, setScoreFlash] = useState(false);

  useEffect(() => {
    const fetchMatch = async () => {
      try {
        const found = (await api.get(`/matches/${id}`)).data;
        if (found) {
          const [team1Res, team2Res] = await Promise.all([
            api.get(`/teams/${found.team1_id}`),
            api.get(`/teams/${found.team2_id}`),
          ]);
          setMatch(found);
          setTeam1Data(team1Res.data || null);
          setTeam2Data(team2Res.data || null);
        }
      } catch (err) {
        console.error('Failed to fetch match details', err);
      }
    };
    fetchMatch();
  }, [id]);

  useMatchSocket((updatedMatch) => {
    if (String(updatedMatch.id) === id) {
      const d = updatedMatch.score_detail || {};
      const newScore = `${d.runs_t1}-${d.runs_t2}`;
      if (prevScoreRef.current && prevScoreRef.current !== newScore) {
        setScoreFlash(true);
        setTimeout(() => setScoreFlash(false), 800);
      }
      prevScoreRef.current = newScore;
      setMatch(updatedMatch);
    }
  });

  if (!match) return (
    <div className="container" style={{ padding: '4rem 1rem', textAlign: 'center' }}>
      <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🏏</div>
      <p>Loading Match Data...</p>
    </div>
  );

  const d = match.score_detail || {};

  // Determine who batted first using batting_first flag
  const battingFirst = d.batting_first; // team name string
  const isTeam1BattingFirst = battingFirst === match.team1 || !battingFirst;
  
  // Assign scorecard cards correctly
  const inn1BatCard = isTeam1BattingFirst ? d.batting_card_t1 : d.batting_card_t2;
  const inn1BowlCard = isTeam1BattingFirst ? d.bowling_card_t2 : d.bowling_card_t1;
  const inn1TeamName = isTeam1BattingFirst ? match.team1 : match.team2;
  const inn1Runs = isTeam1BattingFirst ? (d.runs_t1 || 0) : (d.runs_t2 || 0);
  const inn1Wickets = isTeam1BattingFirst ? (d.wickets_t1 || 0) : (d.wickets_t2 || 0);

  const inn2BatCard = isTeam1BattingFirst ? d.batting_card_t2 : d.batting_card_t1;
  const inn2BowlCard = isTeam1BattingFirst ? d.bowling_card_t1 : d.bowling_card_t2;
  const inn2TeamName = isTeam1BattingFirst ? match.team2 : match.team1;
  const inn2Runs = isTeam1BattingFirst ? (d.runs_t2 || 0) : (d.runs_t1 || 0);
  const inn2Wickets = isTeam1BattingFirst ? (d.wickets_t2 || 0) : (d.wickets_t1 || 0);

  const innings = Number(d.innings || 1);

  return (
    <div className="match-details-container">
      
      {/* Back button */}
      <Link to={`/sport/cricket`} className="match-back-link">
        ← Back to Cricket
      </Link>

      {/* CB-Style Header */}
      <div className="match-header-section">
        <div className="match-header-glow"></div>
        <div className="match-header-content">
          <div>
            <h2 className="match-header-title">{match.team1} vs {match.team2}</h2>
            <div className="match-header-meta">
              <span>{d.match_type || 'T20'} {d.custom_overs ? `(${d.custom_overs} overs)` : ''}</span>
              <span>•</span>
              <span>{d.venue || 'Stadium'}</span>
            </div>
            {d.toss && (
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                🪙 {d.toss}
              </p>
            )}
          </div>
          <span className={`match-status-badge match-status-${match.status}`}>
            {match.status === 'live' && <span className="live-dot"></span>}
            {match.status.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="match-tabs-container">
        {['info', 'live', 'scorecard', 'highlights'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`match-tab-btn ${activeTab === tab ? 'active' : ''}`}
          >
            {tab === 'highlights' ? '✨ ' : ''}{tab}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="match-content-card">

        {/* INFO TAB */}
        {activeTab === 'info' && (
          <div>
            <h3 className="admin-section-title">Match Info</h3>
            <div className="match-info-grid" style={{ marginBottom: '2rem' }}>
              {[
                ['Match', `${match.team1} vs ${match.team2}, ${d.match_type || 'T20'}${d.custom_overs ? ` (${d.custom_overs} overs)` : ''}`],
                ['Date', new Date(match.scheduled_time).toLocaleString()],
                ['Toss', d.toss || 'TBD'],
                ['Venue', d.venue || 'TBD'],
                ['Batting First', battingFirst || 'TBD'],
              ].map(([label, val]) => (
                <div key={label} className="match-info-item" style={{ display: 'flex', gap: '0.5rem', padding: '1rem' }}>
                  <strong style={{ minWidth: '120px', color: 'var(--color-text-muted)', flexShrink: 0 }}>{label}</strong>
                  <span>{val}</span>
                </div>
              ))}
            </div>

            <h3 className="admin-section-title">Playing Squads</h3>
            <div className="match-squad-grid">
              {[
                { name: match.team1, data: team1Data },
                { name: match.team2, data: team2Data },
              ].map(({ name, data }) => (
                <div key={name}>
                  <h4 style={{ color: 'var(--color-primary)', marginBottom: '1rem', fontFamily: 'var(--font-heading)' }}>{name}</h4>
                  <ul className="admin-squad-list">
                    {data?.squad?.length > 0 ? data.squad.map((p, i) => (
                      <li key={i} className="admin-squad-item">
                        <span>{p.name}</span>
                        {p.is_substitute && <span style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>SUB</span>}
                      </li>
                    )) : <li style={{ color: 'var(--color-text-muted)', fontSize: '0.88rem' }}>Squad not announced</li>}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* LIVE TAB */}
        {activeTab === 'live' && (
          <div className={scoreFlash ? 'score-flash' : ''}>
            {d.toss && (
              <div style={{ marginBottom: '1rem', padding: '0.6rem 1rem', background: 'rgba(255,255,255,0.04)', borderRadius: '8px', fontSize: '0.88rem', color: 'var(--color-text-muted)' }}>
                🪙 {d.toss}
              </div>
            )}
            {innings === 2 && d.target && (
              <div style={{ marginBottom: '1rem', padding: '0.6rem 1rem', background: 'rgba(34,197,94,0.1)', borderRadius: '8px', fontSize: '0.88rem', border: '1px solid rgba(34,197,94,0.3)' }}>
                🎯 <strong>{inn2TeamName}</strong> need {d.target} to win. Req RR: {d.required_run_rate || '--'}
              </div>
            )}
            <SportScoreboard match={match} />
            {(() => {
              const hasCurrent = d.over_progression && d.over_progression.trim() !== '';
              const hasPrev = d.prev_over_progression && d.prev_over_progression.trim() !== '';
              const displayBalls = hasCurrent ? d.over_progression : (hasPrev ? d.prev_over_progression : null);
              const isPrev = !hasCurrent && hasPrev;
              if (!displayBalls) return null;
              const legalCount = displayBalls.split(' ').filter(b => b && b !== 'WD' && b !== 'NB').length;
              return (
                <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                  <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginBottom: '0.4rem' }}>
                    {isPrev ? 'Prev Over' : 'This Over'} · {legalCount}/6 balls
                    {isPrev && <span style={{ marginLeft: '0.5rem', color: '#f59e0b', fontSize: '0.7rem' }}>Waiting for new over…</span>}
                  </div>
                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    {displayBalls.trim().split(' ').filter(Boolean).map((b, i) => {
                      const isExtra = b === 'WD' || b === 'NB';
                      return (
                        <span key={i} style={{
                          padding: '0.2rem 0.5rem', borderRadius: '6px', fontWeight: 'bold',
                          background: b === 'W' ? '#ef4444' : b === '6' ? '#10b981' : b === '4' ? '#3b82f6'
                            : isExtra ? '#f59e0b' : isPrev ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.12)',
                          color: 'white',
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
          </div>
        )}

        {/* SCORECARD TAB */}
        {activeTab === 'scorecard' && (
          <div>
            <ScorecardInnings
              title={`${inn1TeamName} Innings`}
              battingCard={inn1BatCard}
              bowlingCard={inn1BowlCard}
              strikerName={innings === 1 ? d.striker : null}
              nonStrikerName={innings === 1 ? d.non_striker : null}
              currentBowler={innings === 1 ? d.current_bowler : null}
              totalRuns={inn1Runs}
              totalWickets={inn1Wickets}
              extras={d.extras_t1 || 0}
            />

            {innings === 2 && (
              <ScorecardInnings
                title={`${inn2TeamName} Innings`}
                battingCard={inn2BatCard}
                bowlingCard={inn2BowlCard}
                strikerName={d.striker}
                nonStrikerName={d.non_striker}
                currentBowler={d.current_bowler}
                totalRuns={inn2Runs}
                totalWickets={inn2Wickets}
                extras={d.extras_t2 || 0}
              />
            )}

            {!inn1BatCard && (
              <p style={{ color: 'var(--color-text-muted)', textAlign: 'center', padding: '2rem' }}>
                🏏 Match has not started yet.
              </p>
            )}
          </div>
        )}

        {/* HIGHLIGHTS TAB */}
        {activeTab === 'highlights' && (
          <div>
            <h3 style={{ margin: '0 0 1.25rem' }}>Key Highlights</h3>
            {d.events_feed ? (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {d.events_feed.split('\n').filter(Boolean).map((ev, i) => {
                  const isSix = ev.includes('6!') || ev.includes('six');
                  const isFour = ev.includes('4!') || ev.includes('four');
                  const isWicket = ev.includes('OUT');
                  const isOver = ev.includes('End of Over');
                  const isMatchEnd = ev.includes('MATCH OVER');
                  const accent = isMatchEnd ? '#f59e0b' : isWicket ? '#ef4444' : isSix ? '#10b981' : isFour ? '#3b82f6' : isOver ? '#6b7280' : 'var(--color-primary)';
                  return (
                    <li key={i} style={{
                      padding: '0.75rem 1rem',
                      background: 'rgba(255,255,255,0.02)',
                      marginBottom: '0.5rem',
                      borderRadius: '6px',
                      borderLeft: `3px solid ${accent}`,
                      fontSize: '0.9rem',
                      lineHeight: '1.4'
                    }}>
                      {ev}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p style={{ color: 'var(--color-text-muted)', textAlign: 'center', padding: '2rem' }}>
                No highlights yet. Start scoring to record them!
              </p>
            )}
          </div>
        )}

      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        .score-flash { animation: flash 0.5s ease; }
        @keyframes flash { 0%{background:transparent} 50%{background:rgba(255,255,255,0.05)} 100%{background:transparent} }
      `}</style>
    </div>
  );
}

export default MatchDetailsCricket;
