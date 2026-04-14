import React, { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import api from '../api';
import { defaultScoreDetail, getSportCategories, getSportMeta } from '../sports/sportsConfig';
import './AdminDashboard.css';

function normalizeCategory(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function shuffle(values) {
  const next = [...values];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
}

function getSquadNames(team) {
  const squad = Array.isArray(team?.squad) ? team.squad : [];
  const names = squad
    .map((player) => (player?.name || '').trim())
    .filter(Boolean);

  return Array.from(new Set(names));
}

function buildLineup(team, category, prefix, randomize = false) {
  const names = randomize ? shuffle(getSquadNames(team)) : getSquadNames(team);
  const isDoubles = (category || '').includes('Doubles');

  const lineup = {
    [`${prefix}_name`]: names[0] || '',
    [`${prefix}_partner`]: '',
  };

  if (isDoubles) {
    lineup[`${prefix}_partner`] = names[1] || '';
  }

  return lineup;
}

function resolveLineup(detail, team, category, prefix) {
  const names = getSquadNames(team);
  const isDoubles = (category || '').includes('Doubles');
  const primaryKey = `${prefix}_name`;
  const partnerKey = `${prefix}_partner`;

  return {
    [primaryKey]: (detail?.[primaryKey] || '').trim() || names[0] || '',
    [partnerKey]: isDoubles ? ((detail?.[partnerKey] || '').trim() || names[1] || '') : '',
  };
}

function getTeamLabel(team) {
  if (!team) return 'Select a team';
  const squadNames = getSquadNames(team);
  return `${team.name}${squadNames.length ? ` · ${squadNames.join(' / ')}` : ''}`;
}

function createRandomizedDrafts(teams, category, sportId) {
  const shuffledTeams = shuffle(teams);
  const drafts = [];
  const byes = [];

  for (let index = 0; index < shuffledTeams.length; index += 2) {
    const team1 = shuffledTeams[index] || null;
    const team2 = shuffledTeams[index + 1] || null;

    if (!team1 || !team2) {
      if (team1) byes.push(team1);
      break;
    }

    drafts.push({
      localId: `${team1.id}-${team2.id}-${index}`,
      team1_id: String(team1.id),
      team2_id: String(team2.id),
      score_detail: {
        ...defaultScoreDetail(sportId),
        category,
        ...buildLineup(team1, category, 'p1', true),
        ...buildLineup(team2, category, 'p2', true),
      },
    });
  }

  return { drafts, byes };
}

export default function AdminRacketSchedule() {
  const { sportId } = useParams();
  const navigate = useNavigate();
  const { user, authLoading } = useAuth();
  const valid = ['badminton', 'table-tennis'].includes(sportId);
  const meta = getSportMeta(sportId);
  const categories = getSportCategories(sportId);

  const initialCategory = categories[0] || 'Mens Singles';

  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState(initialCategory);
  const [scheduleDrafts, setScheduleDrafts] = useState([]);
  const [byeTeams, setByeTeams] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setSelectedCategory(initialCategory);
    setScheduleDrafts([]);
    setByeTeams([]);
  }, [sportId, initialCategory]);

  useEffect(() => {
    if (authLoading || !user || !valid) return;

    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const res = await api.get(`/teams/sport/${sportId}`);
        if (!mounted) return;
        setTeams(res.data || []);
      } catch (error) {
        if (mounted) setTeams([]);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [authLoading, user, sportId, valid]);

  const categoryTeams = useMemo(
    () => teams.filter((team) => normalizeCategory(team.category) === selectedCategory),
    [teams, selectedCategory]
  );

  useEffect(() => {
    if (loading) return;
    if (scheduleDrafts.length > 0) return;
    if (categoryTeams.length < 2) {
      setScheduleDrafts([]);
      setByeTeams(categoryTeams);
      return;
    }

    const generated = createRandomizedDrafts(categoryTeams, selectedCategory, sportId);
    setScheduleDrafts(generated.drafts);
    setByeTeams(generated.byes);
  }, [loading, categoryTeams, selectedCategory, scheduleDrafts.length, sportId]);

  const isDoubles = selectedCategory.includes('Doubles');

  const regenerateSchedule = () => {
    if (categoryTeams.length < 2) {
      setScheduleDrafts([]);
      setByeTeams(categoryTeams);
      return;
    }

    const generated = createRandomizedDrafts(categoryTeams, selectedCategory, sportId);
    setScheduleDrafts(generated.drafts);
    setByeTeams(generated.byes);
  };

  const handleCategoryChange = (category) => {
    setSelectedCategory(category);
    const availableTeams = teams.filter((team) => normalizeCategory(team.category) === category);
    if (availableTeams.length < 2) {
      setScheduleDrafts([]);
      setByeTeams(availableTeams);
      return;
    }

    const generated = createRandomizedDrafts(availableTeams, category, sportId);
    setScheduleDrafts(generated.drafts);
    setByeTeams(generated.byes);
  };

  const updateDraft = (localId, updater) => {
    setScheduleDrafts((prev) => prev.map((draftItem) => {
      if (draftItem.localId !== localId) return draftItem;
      return updater(draftItem);
    }));
  };

  const handleSave = async (event) => {
    event.preventDefault();

    if (scheduleDrafts.length === 0) {
      alert('No matches were generated for this category.');
      return;
    }

    try {
      setSaving(true);
      const createdMatches = [];

      for (const draftItem of scheduleDrafts) {
        const resolvedTeam1 = teams.find((team) => String(team.id) === String(draftItem.team1_id)) || null;
        const resolvedTeam2 = teams.find((team) => String(team.id) === String(draftItem.team2_id)) || null;

        if (!resolvedTeam1 || !resolvedTeam2) {
          throw new Error('One of the scheduled teams could not be resolved.');
        }

        const nextDetail = {
          ...defaultScoreDetail(sportId),
          ...draftItem.score_detail,
          category: selectedCategory,
          ...resolveLineup(draftItem.score_detail, resolvedTeam1, selectedCategory, 'p1'),
          ...resolveLineup(draftItem.score_detail, resolvedTeam2, selectedCategory, 'p2'),
        };

        if (isDoubles && (!nextDetail.p1_name || !nextDetail.p1_partner || !nextDetail.p2_name || !nextDetail.p2_partner)) {
          throw new Error('Every doubles match needs two players on each side.');
        }

        const res = await api.post('/matches', {
          sport_id: sportId,
          team1_id: Number(draftItem.team1_id),
          team2_id: Number(draftItem.team2_id),
          score_detail: nextDetail,
        });
        createdMatches.push(res.data.id);
      }

      if (createdMatches.length === 1) {
        navigate(`/admin/score/${sportId}?match=${createdMatches[0]}`);
        return;
      }

      navigate('/admin');
    } catch (error) {
      alert(error.response?.data?.detail || error.message || 'Error creating racket matches');
    } finally {
      setSaving(false);
    }
  };

  if (authLoading) {
    return <div className="container"><p style={{ color: 'var(--color-text-muted)' }}>Checking admin session…</p></div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!valid) {
    return <Navigate to="/admin" replace />;
  }

  const topTeams = categoryTeams.length;

  return (
    <div className="container">
      <div className="page-header">
        <p className="hero-tag" style={{ marginBottom: '0.5rem' }}>
          <Link to="/admin" style={{ color: 'var(--color-primary)' }}>← Admin</Link>
        </p>
        <h1 className="page-title">
          {meta.icon} {meta.name} racket schedule
        </h1>
        <p className="hero-subtitle" style={{ marginTop: '0.5rem' }}>
          Build randomized matches for every team in the selected subcategory. Lineups are auto-filled from squads and can still be edited before saving.
        </p>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="admin-grid-desks" style={{ marginBottom: '1rem' }}>
          {categories.map((category) => (
            <button
              key={category}
              type="button"
              className="btn-outline btn-sm"
              onClick={() => handleCategoryChange(category)}
              style={{
                textAlign: 'center',
                borderColor: selectedCategory === category ? 'var(--color-primary)' : 'rgba(255,255,255,0.15)',
                color: selectedCategory === category ? 'var(--color-primary)' : 'var(--color-text-main)',
              }}
            >
              {category}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
          <button type="button" className="btn-outline btn-sm" onClick={regenerateSchedule}>
            Shuffle all pairings
          </button>
        </div>

        <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
          {topTeams} team{topTeams === 1 ? '' : 's'} found in {selectedCategory || 'this category'}.
        </p>
        {byeTeams.length > 0 && (
          <p style={{ margin: '0.5rem 0 0', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
            Bye this round: {byeTeams.map((team) => team.name).join(', ')}
          </p>
        )}
      </div>

      {loading ? (
        <p style={{ color: 'var(--color-text-muted)' }}>Loading teams…</p>
      ) : teams.length === 0 ? (
        <div className="card">
          <p>No teams found for this sport yet.</p>
          <Link to="/admin" className="btn-primary" style={{ display: 'inline-block', marginTop: '1rem' }}>
            Back to dashboard
          </Link>
        </div>
      ) : scheduleDrafts.length === 0 ? (
        <div className="card">
          <p>At least two teams are required to generate a random schedule for this category.</p>
        </div>
      ) : (
        <form onSubmit={handleSave}>
          {scheduleDrafts.map((draftItem, index) => {
            const team1 = teams.find((team) => String(team.id) === String(draftItem.team1_id)) || null;
            const team2 = teams.find((team) => String(team.id) === String(draftItem.team2_id)) || null;

            return (
              <div className="card" style={{ marginBottom: '1.25rem' }} key={draftItem.localId}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      Match {index + 1}
                    </div>
                    <h3 style={{ margin: '0.25rem 0 0' }}>{team1?.name || 'Team 1'} vs {team2?.name || 'Team 2'}</h3>
                  </div>
                  <button type="button" className="btn-outline btn-sm" onClick={() => {
                    const refreshed = createRandomizedDrafts([team1, team2].filter(Boolean), selectedCategory, sportId).drafts[0];
                    if (refreshed) {
                      updateDraft(draftItem.localId, () => ({ ...draftItem, score_detail: { ...draftItem.score_detail, ...refreshed.score_detail } }));
                    }
                  }}>
                    Shuffle lineups
                  </button>
                </div>

                <div className="admin-form-two-col" style={{ gap: '1rem', marginBottom: '1rem' }}>
                  <div style={{ padding: '1rem', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', background: 'rgba(255,255,255,0.02)' }}>
                    <strong>{team1?.name || 'Team 1'} lineup</strong>
                    <div style={{ display: 'grid', gap: '0.85rem', marginTop: '0.85rem' }}>
                      <div className="input-group" style={{ marginBottom: 0 }}>
                        <label className="input-label">Primary player</label>
                        <input
                          className="input-field"
                          value={draftItem.score_detail.p1_name || ''}
                          onChange={(e) => updateDraft(draftItem.localId, (current) => ({
                            ...current,
                            score_detail: { ...current.score_detail, p1_name: e.target.value },
                          }))}
                          placeholder="Enter player name"
                        />
                      </div>
                      {isDoubles && (
                        <div className="input-group" style={{ marginBottom: 0 }}>
                          <label className="input-label">Partner</label>
                          <input
                            className="input-field"
                            value={draftItem.score_detail.p1_partner || ''}
                            onChange={(e) => updateDraft(draftItem.localId, (current) => ({
                              ...current,
                              score_detail: { ...current.score_detail, p1_partner: e.target.value },
                            }))}
                            placeholder="Enter partner name"
                          />
                        </div>
                      )}
                      <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '0.82rem' }}>
                        {getSquadNames(team1).join(' / ') || 'No squad registered'}
                      </p>
                    </div>
                  </div>

                  <div style={{ padding: '1rem', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', background: 'rgba(255,255,255,0.02)' }}>
                    <strong>{team2?.name || 'Team 2'} lineup</strong>
                    <div style={{ display: 'grid', gap: '0.85rem', marginTop: '0.85rem' }}>
                      <div className="input-group" style={{ marginBottom: 0 }}>
                        <label className="input-label">Primary player</label>
                        <input
                          className="input-field"
                          value={draftItem.score_detail.p2_name || ''}
                          onChange={(e) => updateDraft(draftItem.localId, (current) => ({
                            ...current,
                            score_detail: { ...current.score_detail, p2_name: e.target.value },
                          }))}
                          placeholder="Enter player name"
                        />
                      </div>
                      {isDoubles && (
                        <div className="input-group" style={{ marginBottom: 0 }}>
                          <label className="input-label">Partner</label>
                          <input
                            className="input-field"
                            value={draftItem.score_detail.p2_partner || ''}
                            onChange={(e) => updateDraft(draftItem.localId, (current) => ({
                              ...current,
                              score_detail: { ...current.score_detail, p2_partner: e.target.value },
                            }))}
                            placeholder="Enter partner name"
                          />
                        </div>
                      )}
                      <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '0.82rem' }}>
                        {getSquadNames(team2).join(' / ') || 'No squad registered'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="admin-form-two-col" style={{ gap: '1rem' }}>
                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label className="input-label">Point Limit</label>
                    <select
                      className="input-field"
                      value={draftItem.score_detail.point_limit || (sportId === 'badminton' ? '21' : '11')}
                      onChange={(e) => updateDraft(draftItem.localId, (current) => ({
                        ...current,
                        score_detail: { ...current.score_detail, point_limit: e.target.value },
                      }))}
                    >
                      <option value="21">21 Points</option>
                      <option value="15">15 Points</option>
                      <option value="11">11 Points</option>
                      <option value="25">25 Points</option>
                      <option value="Custom">Custom</option>
                    </select>
                  </div>

                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label className="input-label">Match Format</label>
                    <select
                      className="input-field"
                      value={draftItem.score_detail.match_format || 'Best of 3'}
                      onChange={(e) => updateDraft(draftItem.localId, (current) => ({
                        ...current,
                        score_detail: { ...current.score_detail, match_format: e.target.value },
                      }))}
                    >
                      <option value="Best of 3">Best of 3</option>
                      <option value="Best of 5">Best of 5</option>
                      <option value="1 Game">1 Game</option>
                    </select>
                  </div>
                </div>

                {String(draftItem.score_detail.point_limit) === 'Custom' && (
                  <div className="input-group" style={{ marginTop: '1rem', marginBottom: 0 }}>
                    <label className="input-label">Custom Point Limit</label>
                    <input
                      type="number"
                      className="input-field"
                      value={draftItem.score_detail.custom_limit || ''}
                      onChange={(e) => updateDraft(draftItem.localId, (current) => ({
                        ...current,
                        score_detail: { ...current.score_detail, custom_limit: e.target.value },
                      }))}
                      placeholder="Enter custom point limit"
                    />
                  </div>
                )}
              </div>
            );
          })}

          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <p style={{ marginTop: 0, color: 'var(--color-text-muted)' }}>
              Scheduled time is handled automatically when the matches are saved.
            </p>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button type="button" className="btn-outline" onClick={() => navigate('/admin')} style={{ flex: 1 }}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" style={{ flex: 2 }} disabled={saving}>
                {saving ? 'Creating Matches...' : `Create ${scheduleDrafts.length} Matches`}
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}