import React from 'react';

const CARD_W      = 200;
const CARD_H      = 100;
const CONN_W      = 52;
const ROUND_W     = CARD_W + CONN_W;
const HEADER_H    = 38;
const BASE_SLOT_H = 124;

function getRoundName(total, idx) {
  const fromEnd = total - 1 - idx;
  if (fromEnd === 0) return 'Final';
  if (fromEnd === 1) return 'Semifinal';
  if (fromEnd === 2) return 'Quarterfinal';
  if (fromEnd === 3) return 'Round of 16';
  return `Round ${idx + 1}`;
}

function fmtTime(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return `${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

function PublicMatchCard({ match }) {
  const isBye  = match.teamB === null && match.teamA !== null;
  const aWon   = !!match.winner && match.winner?.id === match.teamA?.id;
  const bWon   = !!match.winner && match.winner?.id === match.teamB?.id;
  const hasWon = !!match.winner;

  const row = (won, isSet, byeRow) => ({
    padding: '5px 10px', display: 'flex', alignItems: 'center', gap: 6, minHeight: 33,
    background: won ? 'rgba(52,211,153,0.09)' : 'transparent',
    opacity: byeRow ? 0.35 : 1,
  });
  const name = (won, isSet) => ({
    flex: 1, fontWeight: won ? 700 : 400, fontSize: '0.82rem',
    color: won ? '#34d399' : isSet ? 'var(--color-text)' : 'var(--color-text-muted)',
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
    fontStyle: !isSet ? 'italic' : 'normal',
  });

  return (
    <div style={{
      width: CARD_W,
      border: `1px solid ${hasWon ? 'rgba(52,211,153,0.3)' : 'rgba(255,255,255,0.1)'}`,
      borderRadius: 10,
      background: hasWon ? 'rgba(52,211,153,0.04)' : 'rgba(255,255,255,0.03)',
      overflow: 'hidden',
    }}>
      <div style={{ padding: '3px 8px', background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {match.uid.replace('r', 'R').replace('m', 'M')}
        </span>
        {(match.scheduled_at || match.venue) && (
          <span style={{ fontSize: '0.6rem', color: 'var(--color-text-muted)', textAlign: 'right', lineHeight: 1.4 }}>
            {fmtTime(match.scheduled_at)}
            {match.venue && <><br/>📍 {match.venue}</>}
          </span>
        )}
      </div>
      <div style={row(aWon, !!match.teamA, false)}>
        {aWon && <span style={{ fontSize: '0.68rem' }}>🏆</span>}
        <span style={name(aWon, !!match.teamA)}>{match.teamA?.name || 'TBD'}</span>
      </div>
      <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '0 8px' }} />
      <div style={row(bWon, !!match.teamB, isBye)}>
        {bWon && <span style={{ fontSize: '0.68rem' }}>🏆</span>}
        <span style={name(bWon, !!match.teamB)}>{isBye ? 'BYE' : (match.teamB?.name || 'TBD')}</span>
      </div>
    </div>
  );
}

export default function BracketView({ rounds }) {
  if (!rounds?.length) return (
    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-muted)' }}>
      No bracket data available.
    </div>
  );

  const numR1    = rounds[0].length;
  const totalH   = numR1 * BASE_SLOT_H;
  const totalW   = rounds.length * ROUND_W + CARD_W + 60;
  const slotH    = rIdx => totalH / rounds[rIdx].length;
  const champion = rounds[rounds.length - 1]?.[0]?.winner;

  return (
    <div style={{ overflowX: 'auto', overflowY: 'visible', padding: '1rem 0' }}>
      <div style={{ position: 'relative', width: totalW, height: totalH + HEADER_H + 8 }}>
        {rounds.map((_, rIdx) => (
          <div key={rIdx} style={{
            position: 'absolute', left: rIdx * ROUND_W, top: 0, width: CARD_W,
            textAlign: 'center', fontSize: '0.72rem', fontWeight: 700,
            color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.06em',
          }}>
            {getRoundName(rounds.length, rIdx)}
          </div>
        ))}

        {rounds.map((round, rIdx) =>
          round.map((match, mIdx) => {
            const sh = slotH(rIdx);
            return (
              <div key={match.uid} style={{ position: 'absolute', left: rIdx * ROUND_W, top: HEADER_H + mIdx * sh + (sh - CARD_H) / 2 }}>
                <PublicMatchCard match={match} />
              </div>
            );
          })
        )}

        {rounds.map((round, rIdx) => {
          if (rIdx >= rounds.length - 1) return null;
          const nxt = rounds[rIdx + 1];
          const csh = slotH(rIdx);
          const col = 'rgba(99,102,241,0.3)';
          return (
            <svg key={rIdx} style={{ position: 'absolute', left: rIdx * ROUND_W + CARD_W, top: HEADER_H, width: CONN_W, height: totalH, overflow: 'visible', pointerEvents: 'none' }}>
              {nxt.map((_, nIdx) => {
                const m1Y = (nIdx * 2) * csh + csh / 2;
                const m2Y = (nIdx * 2 + 1) * csh + csh / 2;
                const mid = (m1Y + m2Y) / 2;
                const cx  = CONN_W / 2;
                return (
                  <g key={nIdx}>
                    <line x1={0}  y1={m1Y} x2={cx} y2={m1Y} stroke={col} strokeWidth="1.5" />
                    <line x1={0}  y1={m2Y} x2={cx} y2={m2Y} stroke={col} strokeWidth="1.5" />
                    <line x1={cx} y1={m1Y} x2={cx} y2={m2Y} stroke={col} strokeWidth="1.5" />
                    <line x1={cx} y1={mid}  x2={CONN_W} y2={mid} stroke={col} strokeWidth="1.5" />
                  </g>
                );
              })}
            </svg>
          );
        })}

        {champion && (
          <div style={{ position: 'absolute', left: rounds.length * ROUND_W + 8, top: HEADER_H + (totalH - 96) / 2, width: 130 }}>
            <div style={{
              background: 'linear-gradient(135deg,#f59e0b,#d97706)', color: '#000',
              padding: '0.9rem 0.75rem', borderRadius: 14, textAlign: 'center',
              fontWeight: 800, boxShadow: '0 6px 24px rgba(245,158,11,0.5)',
            }}>
              <div style={{ fontSize: '1.6rem' }}>🏆</div>
              <div style={{ fontSize: '0.6rem', letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 3 }}>Champion</div>
              <div style={{ fontSize: '0.9rem', marginTop: 4, lineHeight: 1.3 }}>{champion.name}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
