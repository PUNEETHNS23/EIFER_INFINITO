import React, { useEffect, useState } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import api from '../api';
import { SPORTS, getSportMeta, CATEGORY_SPORTS, getSportCategories } from '../sports/sportsConfig';
import SportScoreEditor from '../components/SportScoreEditor';

function AdminSportScore() {
  const { user, authLoading } = useAuth();
  const { sportId } = useParams();
  const [searchParams] = useSearchParams();
  const matchParam = searchParams.get('match');

  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('all');

  const meta = getSportMeta(sportId);
  const valid = SPORTS.some((s) => s.id === sportId);
  const categorizedSports = Object.keys(CATEGORY_SPORTS);
  const isCategorizedSport = categorizedSports.includes(sportId);
  const allowedSports = user?.allowed_sports || [];
  const canAccessSport = allowedSports.length === 0 || allowedSports.includes(sportId);

  const normalizeCategory = (value) => (typeof value === 'string' ? value.trim() : '');

  const filteredMatches = isCategorizedSport && categoryFilter !== 'all'
    ? matches.filter((m) => normalizeCategory(m?.score_detail?.category) === categoryFilter)
    : matches;

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
    setCategoryFilter('all');
  }, [sportId]);

  useEffect(() => {
    if (!matchParam || !filteredMatches.length) return;
    const el = document.getElementById(`match-editor-${matchParam}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [matchParam, filteredMatches]);

  if (authLoading) {
    return <div className="container"><p style={{ color: 'var(--color-text-muted)' }}>Checking admin session…</p></div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!valid) {
    return <Navigate to="/admin" replace />;
  }

  if (!canAccessSport) {
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
        {isCategorizedSport && (
          <div className="input-group" style={{ maxWidth: '320px', marginTop: '1rem', marginBottom: 0 }}>
            <label className="input-label" style={{ fontSize: '0.95rem', marginBottom: '0.35rem' }}>Filter by Subcategory</label>
            <select
              className="input-field"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="all">All Subcategories</option>
              {getSportCategories(sportId).map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>
        )}
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
      ) : filteredMatches.length === 0 ? (
        <div className="card">
          <p>No matches found for the selected subcategory.</p>
        </div>
      ) : (
        filteredMatches.map((m) => (
          <div key={m.id} id={`match-editor-${m.id}`}>
            <SportScoreEditor match={m} onSaved={load} />
          </div>
        ))
      )}
    </div>
  );
}

export default AdminSportScore;
