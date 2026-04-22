import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../api';
import { useMatchSocket } from '../hooks/useMatchSocket';
import SportScoreboard from '../components/SportScoreboard';
import { getSportMeta } from '../sports/sportsConfig';
import './MatchDetails.css';

function getVenue(detail) {
  return detail?.venue || detail?.place || detail?.location || 'TBD';
}

function getTossText(detail) {
  if (detail?.toss && String(detail.toss).trim()) return detail.toss;
  if (detail?.toss_winner && detail?.toss_decision) {
    return `${detail.toss_winner} won the toss and elected to ${String(detail.toss_decision).toLowerCase()} first`;
  }
  return 'TBD';
}

function getBattingFirst(detail) {
  return detail?.batting_first || detail?.first_turn || detail?.first_server || 'TBD';
}

function getScoreSummaryRows(match, detail) {
  const sid = match?.sport_id;
  const t1 = match?.team1 || 'Team 1';
  const t2 = match?.team2 || 'Team 2';

  if (sid === 'football') {
    return [
      ['Goals', `${t1}: ${detail?.goals_t1 ?? 0} | ${t2}: ${detail?.goals_t2 ?? 0}`],
      ['Match Clock', detail?.period || 'TBD'],
      ['Duration', `${detail?.match_minutes || 90} mins`],
    ];
  }

  if (sid === 'volleyball') {
    return [
      ['Sets', `${t1}: ${detail?.sets_t1 ?? detail?.setsA ?? 0} | ${t2}: ${detail?.sets_t2 ?? detail?.setsB ?? 0}`],
      ['Current Set', `${detail?.currentSet ?? 1}`],
      ['Current Points', `${t1}: ${detail?.pointsA ?? 0} | ${t2}: ${detail?.pointsB ?? 0}`],
    ];
  }

  if (sid === 'badminton' || sid === 'table-tennis') {
    return [
      ['Games', `${t1}: ${detail?.games_t1 ?? 0} | ${t2}: ${detail?.games_t2 ?? 0}`],
      ['Current Points', `${t1}: ${detail?.current_p1 ?? 0} | ${t2}: ${detail?.current_p2 ?? 0}`],
      ['Serving', detail?.serving === 't2' ? t2 : t1],
      ['Format', detail?.match_format || 'Best of 3'],
    ];
  }

  if (sid === 'tug-of-war') {
    return [
      ['Rounds', `${t1}: ${detail?.rounds_t1 ?? 0} | ${t2}: ${detail?.rounds_t2 ?? 0}`],
      ['Format', detail?.match_format || 'Best of 3'],
    ];
  }

  if (sid === 'arm-wrestling') {
    return [
      ['Rounds', `${t1}: ${detail?.rounds_t1 ?? 0} | ${t2}: ${detail?.rounds_t2 ?? 0}`],
    ];
  }

  if (sid === 'carrom') {
    return [
      ['Points', `${t1}: ${detail?.points_t1 ?? 0} | ${t2}: ${detail?.points_t2 ?? 0}`],
      ['Category', detail?.category || 'TBD'],
    ];
  }

  if (sid === 'chess') {
    return [
      ['Winner', detail?.winner || 'TBD'],
      ['Category', detail?.category || 'TBD'],
    ];
  }

  if (sid === 'kho-kho') {
    return [
      ['Winner', detail?.winner || 'TBD'],
      ['Timer', `${detail?.minutes ?? 0}m ${detail?.seconds ?? 0}s`],
      ['Category', detail?.category || 'TBD'],
    ];
  }

  if (sid === 'esports') {
    return [
      ['Maps', `${t1}: ${detail?.maps_t1 ?? 0} | ${t2}: ${detail?.maps_t2 ?? 0}`],
    ];
  }

  return [
    ['Score', `${t1}: ${match?.score_t1 ?? 0} | ${t2}: ${match?.score_t2 ?? 0}`],
    ['Status', String(match?.status || 'upcoming').toUpperCase()],
  ];
}

function MatchDetailsGeneric() {
  const { id } = useParams();
  const [match, setMatch] = useState(null);
  const [team1Data, setTeam1Data] = useState(null);
  const [team2Data, setTeam2Data] = useState(null);
  const [activeTab, setActiveTab] = useState('info');

  useEffect(() => {
    const fetchMatch = async () => {
      try {
        const matchRes = await api.get(`/matches/${id}`);
        const found = matchRes.data;
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
      setMatch(updatedMatch);
    }
  });

  if (!match) {
    return (
      <div className="container" style={{ padding: '4rem 1rem', textAlign: 'center' }}>
        <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🏟️</div>
        <p>Loading Match Data...</p>
      </div>
    );
  }

  const detail = match.score_detail || {};
  const meta = getSportMeta(match.sport_id);
  const tossText = getTossText(detail);
  const scoreRows = getScoreSummaryRows(match, detail);

  const infoRows = [
    ['Match', `${match.team1} vs ${match.team2}, ${meta.name}`],
    ['Date', new Date(match.scheduled_time).toLocaleString()],
    ['Venue', getVenue(detail)],
    ['Toss', tossText],
    ['Batting First', getBattingFirst(detail)],
  ];

  const teamBlocks = [
    { name: match.team1, data: team1Data },
    { name: match.team2, data: team2Data },
  ];

  return (
    <div className="match-details-container">
      <Link to={`/sport/${match.sport_id}`} className="match-back-link">
        ← Back to {meta.name}
      </Link>

      <div className="match-header-section">
        <div className="match-header-glow"></div>
        <div className="match-header-content">
          <div>
            <h2 className="match-header-title">{match.team1} vs {match.team2}</h2>
            <div className="match-header-meta">
              <span>{meta.name.toUpperCase()}</span>
              <span>•</span>
              <span>{getVenue(detail)}</span>
            </div>
            {tossText !== 'TBD' && (
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                🪙 {tossText}
              </p>
            )}
          </div>
          <span className={`match-status-badge match-status-${match.status}`}>
            {match.status === 'live' && <span className="live-dot"></span>}
            {String(match.status || 'upcoming').toUpperCase()}
          </span>
        </div>
      </div>

      <div className="match-tabs-container">
        {['info', 'live', 'scorecard'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`match-tab-btn ${activeTab === tab ? 'active' : ''}`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="match-content-card">
        {activeTab === 'info' && (
          <div>
            <h3 className="admin-section-title">Match Info</h3>
            <div className="match-info-grid" style={{ marginBottom: '2rem' }}>
              {infoRows.map(([label, value]) => (
                <div key={label} className="match-info-item" style={{ display: 'flex', gap: '0.5rem', padding: '1rem' }}>
                  <strong style={{ minWidth: '120px', color: 'var(--color-text-muted)', flexShrink: 0 }}>{label}</strong>
                  <span>{value}</span>
                </div>
              ))}
            </div>

            <h3 className="admin-section-title">Playing Squads</h3>
            <div className="match-squad-grid">
              {teamBlocks.map(({ name, data }) => (
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

        {activeTab === 'live' && (
          <div>
            {tossText !== 'TBD' && (
              <div style={{ marginBottom: '1rem', padding: '0.6rem 1rem', background: 'rgba(255,255,255,0.04)', borderRadius: '8px', fontSize: '0.88rem', color: 'var(--color-text-muted)' }}>
                🪙 {tossText}
              </div>
            )}
            <SportScoreboard match={match} team1Data={team1Data} team2Data={team2Data} />
          </div>
        )}

        {activeTab === 'scorecard' && (
          <div>
            <h3 className="admin-section-title">Score Summary</h3>
            <div className="match-info-grid" style={{ marginBottom: '1rem' }}>
              {scoreRows.map(([label, value]) => (
                <div key={label} className="match-info-item" style={{ display: 'flex', gap: '0.5rem', padding: '1rem' }}>
                  <strong style={{ minWidth: '140px', color: 'var(--color-text-muted)', flexShrink: 0 }}>{label}</strong>
                  <span>{value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default MatchDetailsGeneric;