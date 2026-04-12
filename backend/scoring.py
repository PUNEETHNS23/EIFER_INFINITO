"""Derive canonical score_t1 / score_t2 from sport-specific score_detail for leaderboard points."""

from __future__ import annotations

from typing import Any, Optional, Tuple


def _as_float(v: Any, default: float = 0.0) -> float:
    try:
        return float(v)
    except (TypeError, ValueError):
        return default


def _as_int(v: Any, default: int = 0) -> int:
    try:
        return int(v)
    except (TypeError, ValueError):
        return default


def derive_primary_scores(sport_id: str, detail: Optional[dict]) -> Tuple[int, int]:
    """
    Map sport-specific JSON to two integers for win/loss/draw logic.
    Convention: higher is better unless sport uses time/weight where we still encode
    winner as (1,0) vs (0,1) or draw as (1,1).
    """
    if not detail:
        return (0, 0)

    sid = (sport_id or "").strip()

    if sid == "football":
        return (
            _as_int(detail.get("goals_t1")),
            _as_int(detail.get("goals_t2")),
        )

    if sid == "volleyball":
        return (
            _as_int(detail.get("sets_t1")),
            _as_int(detail.get("sets_t2")),
        )

    if sid == "cricket":
        return (
            _as_int(detail.get("runs_t1")),
            _as_int(detail.get("runs_t2")),
        )

    if sid == "carrom":
        return (
            _as_int(detail.get("points_t1")),
            _as_int(detail.get("points_t2")),
        )

    if sid == "kho-kho":
        return (
            _as_int(detail.get("points_t1")),
            _as_int(detail.get("points_t2")),
        )

    if sid == "chess":
        w = (detail.get("winner") or "").lower()
        if w in ("draw", "d", "½"):
            return (1, 1)
        if w in ("t1", "team1", "white", "w"):
            return (1, 0)
        if w in ("t2", "team2", "black", "b"):
            return (0, 1)
        return (0, 0)

    if sid == "athletics":
        t1 = _as_float(detail.get("time_t1_sec"), 1e9)
        t2 = _as_float(detail.get("time_t2_sec"), 1e9)
        if t1 < t2:
            return (1, 0)
        if t2 < t1:
            return (0, 1)
        return (1, 1)

    if sid == "weight-lifting":
        k1 = _as_float(detail.get("kg_t1"))
        k2 = _as_float(detail.get("kg_t2"))
        if k1 > k2:
            return (1, 0)
        if k2 > k1:
            return (0, 1)
        return (1, 1)

    if sid in ("badminton", "table-tennis"):
        return (
            _as_int(detail.get("games_t1")),
            _as_int(detail.get("games_t2")),
        )

    if sid in ("arm-wrestling", "tug-of-war"):
        return (
            _as_int(detail.get("rounds_t1")),
            _as_int(detail.get("rounds_t2")),
        )

    if sid == "esports":
        return (
            _as_int(detail.get("maps_t1")),
            _as_int(detail.get("maps_t2")),
        )

    # Fallback: generic numeric duel
    return (
        _as_int(detail.get("score_t1")),
        _as_int(detail.get("score_t2")),
    )


def default_score_detail(sport_id: str) -> dict:
    sid = (sport_id or "").strip()
    defaults = {
        "football": {"goals_t1": 0, "goals_t2": 0, "venue": "", "match_minutes": 90},
        "volleyball": {"sets_t1": 0, "sets_t2": 0},
        "cricket": {
            "runs_t1": 0, "wickets_t1": 0, "runs_t2": 0, "wickets_t2": 0,
            "overs_t1": "0.0", "overs_t2": "0.0", "innings": 1, "target": 0,
            "match_type": "T20", "venue": "", "city": "", "toss": "",
            "striker": "", "non_striker": "", "current_bowler": "",
            "striker_runs": 0, "striker_balls": 0, "striker_fours": 0, "striker_sixes": 0, "striker_sr": 0,
            "non_striker_runs": 0, "non_striker_balls": 0, "non_striker_fours": 0, "non_striker_sixes": 0, "non_striker_sr": 0,
            "bowler_overs": "0.0", "bowler_runs": 0, "bowler_wickets": 0, "bowler_econ": 0,
            "run_rate": 0, "required_run_rate": 0, "partnership_runs": 0, "win_probability_t1": 50,
            "current_ball_result": "", "over_progression": "", "last_wickets": "", "fall_of_wickets": "", "top_performers": "", "events_feed": "",
            "team1_logo": "", "team2_logo": "",
        },
        "carrom": {"points_t1": 0, "points_t2": 0},
        "kho-kho": {"points_t1": 0, "points_t2": 0},
        "chess": {"winner": "draw"},
        "athletics": {"time_t1_sec": 0, "time_t2_sec": 0},
        "weight-lifting": {"kg_t1": 0, "kg_t2": 0},
        "badminton": {"games_t1": 0, "games_t2": 0, "current_p1": 0, "current_p2": 0, "past_games": [], "serving": "t1", "p1_name": "", "p2_name": "", "toss_winner": "", "toss_decision": "", "point_limit": "21"},
        "table-tennis": {"games_t1": 0, "games_t2": 0, "current_p1": 0, "current_p2": 0, "past_games": [], "serving": "t1", "p1_name": "", "p2_name": "", "toss_winner": "", "toss_decision": "", "point_limit": "11"},
        "arm-wrestling": {"rounds_t1": 0, "rounds_t2": 0},
        "tug-of-war": {"rounds_t1": 0, "rounds_t2": 0},
        "esports": {"maps_t1": 0, "maps_t2": 0},
    }
    return dict(defaults.get(sid, {"score_t1": 0, "score_t2": 0}))
