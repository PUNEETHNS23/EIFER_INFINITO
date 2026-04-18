from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import pytest

from backend import auth, main, models


@pytest.fixture()
def client(tmp_path):
    db_path = tmp_path / "test.db"
    engine = create_engine(
        f"sqlite:///{db_path}",
        connect_args={"check_same_thread": False},
    )
    testing_session_local = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    models.Base.metadata.create_all(bind=engine)

    def override_get_db():
        db = testing_session_local()
        try:
            yield db
        finally:
            db.close()

    original_startup_handlers = list(main.app.router.on_startup)
    main.app.router.on_startup = []
    main.app.dependency_overrides[main.get_db] = override_get_db
    main.app.dependency_overrides[auth.verify_token] = lambda: "admin"

    try:
        with TestClient(main.app) as test_client:
            yield test_client
    finally:
        main.app.dependency_overrides.clear()
        main.app.router.on_startup = original_startup_handlers
        models.Base.metadata.drop_all(bind=engine)
        engine.dispose()


def test_athletics_top_rank_tie_can_be_resolved_by_rematch(client: TestClient):
    created = client.post(
        "/api/athletics/events",
        json={"event_type": "boys_100m", "label": "Final"},
    )
    assert created.status_code == 200, created.text
    event_id = created.json()["id"]

    for payload in [
        {"team_name": "Runner A", "players": [], "time_sec": 10.0, "is_disqualified": False},
        {"team_name": "Runner B", "players": [], "time_sec": 10.0, "is_disqualified": False},
        {"team_name": "Runner C", "players": [], "time_sec": 11.0, "is_disqualified": False},
    ]:
        response = client.post(f"/api/athletics/events/{event_id}/entries", json=payload)
        assert response.status_code == 200, response.text

    detail = client.get(f"/api/athletics/events/{event_id}")
    assert detail.status_code == 200, detail.text
    entries = detail.json()["entries"]
    assert [e["rank"] for e in entries] == [1, 1, 3]

    tied = {e["team_name"]: e["id"] for e in entries if e["rank"] == 1}
    rematch = client.post(
        f"/api/athletics/events/{event_id}/rematch",
        json={
            "rank": 1,
            "results": [
                {"entry_id": tied["Runner A"], "final_score": 9.800},
                {"entry_id": tied["Runner B"], "final_score": 9.900},
            ],
        },
    )
    assert rematch.status_code == 200, rematch.text

    updated = client.get(f"/api/athletics/events/{event_id}")
    assert updated.status_code == 200, updated.text
    updated_entries = updated.json()["entries"]
    assert [e["team_name"] for e in updated_entries] == ["Runner A", "Runner B", "Runner C"]
    assert [e["rank"] for e in updated_entries] == [1, 2, 3]
    assert updated_entries[0]["rematch_score"] == pytest.approx(9.8)
    assert updated_entries[1]["rematch_score"] == pytest.approx(9.9)


def test_weightlifting_rank_two_tie_can_be_resolved_by_rematch(client: TestClient):
    created = client.post(
        "/api/weightlifting/events",
        json={"label": "Open"},
    )
    assert created.status_code == 200, created.text
    event_id = created.json()["id"]

    entries = [
        {
            "name": "Lifter A",
            "squat": [100, 0, 0],
            "bench_press": [100, 0, 0],
            "dead_lift": [100, 0, 0],
            "is_disqualified": False,
        },
        {
            "name": "Lifter B",
            "squat": [100, 0, 0],
            "bench_press": [90, 0, 0],
            "dead_lift": [100, 0, 0],
            "is_disqualified": False,
        },
        {
            "name": "Lifter C",
            "squat": [100, 0, 0],
            "bench_press": [90, 0, 0],
            "dead_lift": [100, 0, 0],
            "is_disqualified": False,
        },
        {
            "name": "Lifter D",
            "squat": [100, 0, 0],
            "bench_press": [80, 0, 0],
            "dead_lift": [100, 0, 0],
            "is_disqualified": False,
        },
    ]
    for payload in entries:
        response = client.post(f"/api/weightlifting/events/{event_id}/entries", json=payload)
        assert response.status_code == 200, response.text

    detail = client.get(f"/api/weightlifting/events/{event_id}")
    assert detail.status_code == 200, detail.text
    ranked = detail.json()["entries"]
    assert [e["rank"] for e in ranked] == [1, 2, 2, 4]

    tied = {e["name"]: e["id"] for e in ranked if e["rank"] == 2}
    rematch = client.post(
        f"/api/weightlifting/events/{event_id}/rematch",
        json={
            "rank": 2,
            "results": [
                {"entry_id": tied["Lifter B"], "final_score": 295.0},
                {"entry_id": tied["Lifter C"], "final_score": 294.0},
            ],
        },
    )
    assert rematch.status_code == 200, rematch.text

    updated = client.get(f"/api/weightlifting/events/{event_id}")
    assert updated.status_code == 200, updated.text
    updated_entries = updated.json()["entries"]
    assert [e["name"] for e in updated_entries] == ["Lifter A", "Lifter B", "Lifter C", "Lifter D"]
    assert [e["rank"] for e in updated_entries] == [1, 2, 3, 4]
    assert updated_entries[1]["rematch_score"] == pytest.approx(295.0)
    assert updated_entries[2]["rematch_score"] == pytest.approx(294.0)
