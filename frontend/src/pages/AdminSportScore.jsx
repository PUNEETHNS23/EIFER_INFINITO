import React, { useEffect, useState } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import { SPORTS, getSportMeta } from '../sports/sportsConfig';
import SportScoreEditor from '../components/SportScoreEditor';

function AdminSportScore() {
  const { user, authLoading } = useAuth();
  const { sportId } = useParams();
  const [searchParams] = useSearchParams();
  const matchParam = searchParams.get('match');

  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);

  const meta = getSportMeta(sportId);
  const valid = SPORTS.some((s) => s.id === sportId);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/matches/sport/${sportId}`);
      setMatches(res.data);
    } catch (e) {
      console.error(e);
      setMatches([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && valid) load();
  }, [user, sportId, valid]);

  useEffect(() => {
    if (!matchParam || !matches.length) return;
    const el = document.getElementById(`match-editor-${matchParam}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [matchParam, matches]);

  if (authLoading) {
    return <div className="container"><p style={{ color: 'var(--color-text-muted)' }}>Checking admin session…</p></div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!valid) {
    return <Navigate to="/admin" replace />;
  }

  return (
    <div className="container">
      <div className="page-header">
        <p className="hero-tag" style={{ marginBottom: '0.5rem' }}>
          <Link to="/admin" style={{ color: 'var(--color-primary)' }}>
            ← Admin
          </Link>
        </p>
        <h1 className="page-title">
          {meta.icon} {meta.name} — score desk
        </h1>
        <p className="hero-subtitle" style={{ marginTop: '0.5rem' }}>
          Updates use sport-specific rules. Saving recalculates leaderboard points when status is completed.
        </p>
      </div>

      {loading ? (
        <p style={{ color: 'var(--color-text-muted)' }}>Loading matches…</p>
      ) : matches.length === 0 ? (
        <div className="card">
          <p>No matches scheduled for this sport yet. Create one from the main admin dashboard.</p>
          <Link to="/admin" className="btn-primary" style={{ display: 'inline-block', marginTop: '1rem' }}>
            Go to dashboard
          </Link>
        </div>
      ) : (
        matches.map((m) => (
          <div key={m.id} id={`match-editor-${m.id}`}>
            <SportScoreEditor match={m} onSaved={load} />
          </div>
        ))
      )}
    </div>
  );
}

export default AdminSportScore;
