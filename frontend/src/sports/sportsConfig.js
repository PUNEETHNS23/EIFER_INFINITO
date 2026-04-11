/** Single source for sport list + default score payloads (kept in sync with backend/scoring.py). */

export const SPORTS = [
  { id: 'athletics', name: 'Athletics', icon: '🏃', theme: 'track' },
  { id: 'cricket', name: 'Cricket', icon: '🏏', theme: 'pitch' },
  { id: 'volleyball', name: 'Volleyball', icon: '🏐', theme: 'court' },
  { id: 'football', name: 'Football', icon: '⚽', theme: 'pitch' },
  { id: 'carrom', name: 'Carrom', icon: '🥏', theme: 'board' },
  { id: 'chess', name: 'Chess', icon: '♟️', theme: 'chess' },
  { id: 'arm-wrestling', name: 'Arm Wrestling', icon: '💪', theme: 'duel' },
  { id: 'weight-lifting', name: 'Weight Lifting', icon: '🏋️', theme: 'platform' },
  { id: 'kho-kho', name: 'Kho Kho', icon: '🏃‍♂️', theme: 'field' },
  { id: 'badminton', name: 'Badminton', icon: '🏸', theme: 'shuttle' },
  { id: 'table-tennis', name: 'Table Tennis', icon: '🏓', theme: 'tt' },
  { id: 'tug-of-war', name: 'Tug of War', icon: '🪢', theme: 'rope' },
  { id: 'esports', name: 'E-Sports', icon: '🎮', theme: 'esports' },
];

export function getSportMeta(sportId) {
  return SPORTS.find((s) => s.id === sportId) || { id: sportId, name: sportId, icon: '🏆', theme: 'default' };
}

export function defaultScoreDetail(sportId) {
  const defaults = {
    football: { goals_t1: 0, goals_t2: 0 },
    volleyball: {
      sets_t1: 0, sets_t2: 0,
      setsA: 0, setsB: 0, pointsA: 0, pointsB: 0,
      currentSet: 1, setHistory: [], servingTeam: 'A', status: 'upcoming', winner: null
    },
    cricket: {
      runs_t1: 0, wickets_t1: 0, runs_t2: 0, wickets_t2: 0,
      overs_t1: '0.0', overs_t2: '0.0', innings: 1, target: 0,
      match_type: 'T20', venue: '', city: '', toss: '',
      striker: '', non_striker: '', current_bowler: '',
      striker_runs: 0, striker_balls: 0, striker_fours: 0, striker_sixes: 0, striker_sr: 0,
      non_striker_runs: 0, non_striker_balls: 0, non_striker_fours: 0, non_striker_sixes: 0, non_striker_sr: 0,
      bowler_overs: '0.0', bowler_runs: 0, bowler_wickets: 0, bowler_econ: 0,
      run_rate: 0, required_run_rate: 0, partnership_runs: 0, win_probability_t1: 50,
      current_ball_result: '', over_progression: '', last_wickets: '', fall_of_wickets: '', top_performers: '', events_feed: '',
      team1_logo: '', team2_logo: '',
    },
    carrom: { points_t1: 0, points_t2: 0 },
    'kho-kho': { points_t1: 0, points_t2: 0 },
    chess: { winner: 'draw' },
    athletics: { time_t1_sec: 0, time_t2_sec: 0 },
    'weight-lifting': { kg_t1: 0, kg_t2: 0 },
    badminton: { games_t1: 0, games_t2: 0, current_p1: 0, current_p2: 0 },
    'table-tennis': { games_t1: 0, games_t2: 0, current_p1: 0, current_p2: 0 },
    'arm-wrestling': { rounds_t1: 0, rounds_t2: 0 },
    'tug-of-war': { rounds_t1: 0, rounds_t2: 0 },
    esports: { maps_t1: 0, maps_t2: 0 },
  };
  return { ...(defaults[sportId] || { score_t1: 0, score_t2: 0 }) };
}

/** Map old rows (no score_detail) to a first editable payload. */
export function hydrateScoreDetail(sportId, match) {
  if (match.score_detail && Object.keys(match.score_detail).length > 0) {
    return { ...match.score_detail };
  }
  const t1 = match.score_t1 ?? 0;
  const t2 = match.score_t2 ?? 0;
  const map = {
    football: { goals_t1: t1, goals_t2: t2 },
    volleyball: {
      sets_t1: t1, sets_t2: t2,
      setsA: t1, setsB: t2, pointsA: 0, pointsB: 0,
      currentSet: 1, setHistory: [], servingTeam: 'A', status: 'upcoming', winner: null
    },
    cricket: {
      ...defaultScoreDetail('cricket'),
      runs_t1: t1,
      runs_t2: t2,
    },
    carrom: { points_t1: t1, points_t2: t2 },
    'kho-kho': { points_t1: t1, points_t2: t2 },
    chess: { winner: t1 === t2 ? 'draw' : t1 > t2 ? 't1' : 't2' },
    athletics: { time_t1_sec: t1 || 0, time_t2_sec: t2 || 0 },
    'weight-lifting': { kg_t1: t1, kg_t2: t2 },
    badminton: { games_t1: t1, games_t2: t2, current_p1: 0, current_p2: 0 },
    'table-tennis': { games_t1: t1, games_t2: t2, current_p1: 0, current_p2: 0 },
    'arm-wrestling': { rounds_t1: t1, rounds_t2: t2 },
    'tug-of-war': { rounds_t1: t1, rounds_t2: t2 },
    esports: { maps_t1: t1, maps_t2: t2 },
  };
  return { ...(map[sportId] || { score_t1: t1, score_t2: t2 }) };
}
