import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api';
import { useMatchSocket } from '../hooks/useMatchSocket';
import SportScoreboard from '../components/SportScoreboard';

function ScorecardInnings({ title, battingCard, bowlingCard, strikerName, nonStrikerName, currentBowler, totalRuns, totalWickets, extras = 0 }) {
  const rows = Object.entries(battingCard || {});
  return (
    <div style={{ marginBottom: '2.5rem' }}>
      <h3 style={{ margin: '0 0 0.5rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.5rem', color: 'var(--color-primary)', fontSize: '1rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
        {title}
      </h3>

      {/* Batting Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', marginBottom: '0.5rem', minWidth: '420px' }}>
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
              <th style={{ padding: '0.6rem 0.75rem' }}>Batter</th>
              <th style={{ padding: '0.6rem 0.75rem' }}>Status</th>
              <th style={{ padding: '0.6rem 0.75rem', textAlign: 'right' }}>R</th>
              <th style={{ padding: '0.6rem 0.75rem', textAlign: 'right' }}>B</th>
              <th style={{ padding: '0.6rem 0.75rem', textAlign: 'right' }}>4s</th>
              <th style={{ padding: '0.6rem 0.75rem', textAlign: 'right' }}>6s</th>
              <th style={{ padding: '0.6rem 0.75rem', textAlign: 'right' }}>SR</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([name, stats]) => {
              const isAtCrease = name === strikerName || name === nonStrikerName;
              return (
                <tr key={name} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '0.9rem', background: isAtCrease ? 'rgba(255,255,255,0.03)' : 'transparent' }}>
                  <td style={{ padding: '0.65rem 0.75rem', fontWeight: isAtCrease ? 'bold' : 'normal' }}>
                    {name} {name === strikerName ? '🏏' : isAtCrease ? '●' : ''}
                  </td>
                  <td style={{ padding: '0.65rem 0.75rem', color: stats.out ? '#ef4444' : '#10b981', fontSize: '0.82rem' }}>
                    {stats.out ? stats.dismissal || 'out' : 'not out'}
                  </td>
                  <td style={{ padding: '0.65rem 0.75rem', fontWeight: 'bold', textAlign: 'right' }}>{stats.runs}</td>
                  <td style={{ padding: '0.65rem 0.75rem', textAlign: 'right' }}>{stats.balls}</td>
                  <td style={{ padding: '0.65rem 0.75rem', textAlign: 'right', color: stats.fours > 0 ? '#3b82f6' : 'inherit' }}>{stats.fours}</td>
                  <td style={{ padding: '0.65rem 0.75rem', textAlign: 'right', color: stats.sixes > 0 ? '#10b981' : 'inherit' }}>{stats.sixes}</td>
                  <td style={{ padding: '0.65rem 0.75rem', textAlign: 'right', fontSize: '0.85rem' }}>{stats.sr || '0.00'}</td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={7} style={{ padding: '1rem', color: 'var(--color-text-muted)', textAlign: 'center' }}>Innings not started</td></tr>
            )}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: '1px solid rgba(255,255,255,0.1)', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
              <td style={{ padding: '0.6rem 0.75rem' }} colSpan={2}>Extras</td>
              <td style={{ padding: '0.6rem 0.75rem', textAlign: 'right' }} colSpan={5}>{extras}</td>
            </tr>
            <tr style={{ borderTop: '1px solid rgba(255,255,255,0.1)', fontWeight: 'bold' }}>
              <td style={{ padding: '0.6rem 0.75rem' }} colSpan={2}>Total</td>
              <td style={{ padding: '0.6rem 0.75rem', textAlign: 'right', fontSize: '1rem' }} colSpan={5}>
                {totalRuns}/{totalWickets}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Bowling Table  */}
      {Object.keys(bowlingCard || {}).length > 0 && (
        <div style={{ overflowX: 'auto', marginTop: '1rem' }}>
          <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', minWidth: '320px' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
                <th style={{ padding: '0.6rem 0.75rem' }}>Bowler</th>
                <th style={{ padding: '0.6rem 0.75rem', textAlign: 'right' }}>O</th>
                <th style={{ padding: '0.6rem 0.75rem', textAlign: 'right' }}>R</th>
                <th style={{ padding: '0.6rem 0.75rem', textAlign: 'right' }}>W</th>
                <th style={{ padding: '0.6rem 0.75rem', textAlign: 'right' }}>ECON</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(bowlingCard).map(([name, stats]) => (
                <tr key={name} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '0.9rem', background: name === currentBowler ? 'rgba(255,255,255,0.03)' : 'transparent' }}>
                  <td style={{ padding: '0.65rem 0.75rem', fontWeight: name === currentBowler ? 'bold' : 'normal' }}>
                    {name} {name === currentBowler ? '⚾' : ''}
                  </td>
                  <td style={{ padding: '0.65rem 0.75rem', textAlign: 'right' }}>{stats.overs}</td>
                  <td style={{ padding: '0.65rem 0.75rem', textAlign: 'right' }}>{stats.runs}</td>
                  <td style={{ padding: '0.65rem 0.75rem', fontWeight: 'bold', textAlign: 'right', color: stats.wickets > 0 ? '#ef4444' : 'inherit' }}>{stats.wickets}</td>
                  <td style={{ padding: '0.65rem 0.75rem', textAlign: 'right', fontSize: '0.85rem' }}>{stats.econ || '0.00'}</td>
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
        const res = await api.get('/matches');
        const found = res.data.find(m => String(m.id) === id);
        if (found) {
          setMatch(found);
          const teamsRes = await api.get('/teams');
          setTeam1Data(teamsRes.data.find(t => t.id === found.team1_id));
          setTeam2Data(teamsRes.data.find(t => t.id === found.team2_id));
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
    <div className="container" style={{ maxWidth: '820px', margin: '0 auto', padding: '1rem 1rem 4rem' }}>
      
      {/* Back button */}
      <div style={{ marginBottom: '1rem' }}>
        <Link to={`/sport/cricket`} style={{ color: 'var(--color-text-muted)', textDecoration: 'none', fontSize: '0.9rem' }}>
          ← Back to Cricket
        </Link>
      </div>

      {/* CB-Style Header */}
      <div style={{
        padding: '1.25rem 1.5rem',
        borderRadius: '12px 12px 0 0',
        borderBottom: '1px solid var(--color-border)',
        background: 'linear-gradient(135deg, var(--color-surface) 0%, rgba(255,255,255,0.03) 100%)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.2rem' }}>{match.team1} vs {match.team2}</h2>
            <p style={{ margin: '0.3rem 0 0', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
              {d.match_type || 'T20'} {d.custom_overs ? `(${d.custom_overs} overs)` : ''} • {d.venue || 'Stadium'}
            </p>
            {d.toss && (
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                🪙 {d.toss}
              </p>
            )}
          </div>
          <span style={{
            flexShrink: 0,
            fontSize: '0.8rem',
            background: match.status === 'live' ? '#16a34a' : match.status === 'completed' ? '#6b7280' : 'var(--color-primary)',
            color: '#fff',
            padding: '0.3rem 0.7rem',
            borderRadius: '20px',
            fontWeight: 'bold',
            letterSpacing: '0.5px',
            display: 'flex',
            alignItems: 'center',
            gap: '0.3rem'
          }}>
            {match.status === 'live' && <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#fff', display: 'inline-block', animation: 'pulse 1.2s infinite' }}></span>}
            {match.status.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', background: 'var(--color-surface)', padding: '0 0.5rem', borderBottom: '1px solid var(--color-border)', gap: '0.25rem' }}>
        {['info', 'live', 'scorecard', 'highlights'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === tab ? '3px solid var(--color-primary)' : '3px solid transparent',
              color: activeTab === tab ? 'var(--color-text-main)' : 'var(--color-text-muted)',
              padding: '0.9rem 1rem',
              fontWeight: activeTab === tab ? '700' : 'normal',
              textTransform: 'uppercase',
              fontSize: '0.82rem',
              cursor: 'pointer',
              transition: 'all 0.2s',
              letterSpacing: '0.5px',
            }}
          >
            {tab === 'highlights' ? '✨ ' : ''}{tab}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ background: 'var(--color-surface)', padding: '1.5rem', borderRadius: '0 0 12px 12px', minHeight: '50vh' }}>

        {/* INFO TAB */}
        {activeTab === 'info' && (
          <div>
            <h3 style={{ margin: '0 0 1rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem' }}>Match Info</h3>
            <div style={{ display: 'grid', gap: '0.75rem', marginBottom: '2rem', fontSize: '0.92rem' }}>
              {[
                ['Match', `${match.team1} vs ${match.team2}, ${d.match_type || 'T20'}${d.custom_overs ? ` (${d.custom_overs} overs)` : ''}`],
                ['Date', new Date(match.scheduled_time).toLocaleString()],
                ['Toss', d.toss || 'TBD'],
                ['Venue', d.venue || 'TBD'],
                ['Batting First', battingFirst || 'TBD'],
              ].map(([label, val]) => (
                <div key={label} style={{ display: 'flex', gap: '0.5rem' }}>
                  <strong style={{ minWidth: '120px', color: 'var(--color-text-muted)', flexShrink: 0 }}>{label}</strong>
                  <span>{val}</span>
                </div>
              ))}
            </div>

            <h3 style={{ margin: '0 0 1rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem' }}>Playing Squads</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
              {[
                { name: match.team1, data: team1Data },
                { name: match.team2, data: team2Data },
              ].map(({ name, data }) => (
                <div key={name}>
                  <h4 style={{ color: 'var(--color-primary)', marginBottom: '0.5rem' }}>{name}</h4>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {data?.squad?.length > 0 ? data.squad.map((p, i) => (
                      <li key={i} style={{ padding: '0.4rem 0', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '0.88rem', display: 'flex', justifyContent: 'space-between' }}>
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
