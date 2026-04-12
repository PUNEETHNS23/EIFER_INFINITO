import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import api from '../api';
import { getSportMeta } from '../sports/sportsConfig';

const RACKET_SPORTS = ['badminton', 'table-tennis'];
const RACKET_CATEGORIES = ['Mens Singles', 'Mens Doubles', 'Womens Singles', 'Womens Doubles', 'Mixed Doubles'];

function AdminCreateMatch() {
  const { sportId } = useParams();
  const navigate = useNavigate();
  const { user, authLoading } = useAuth();
  const isRacketSport = RACKET_SPORTS.includes(sportId);
  
  const [teams, setTeams] = useState([]);
  const [newMatch, setNewMatch] = useState({
    sport_id: sportId,
    team1_id: '',
    team2_id: '',
    scheduled_time: '',
    score_detail:
      sportId === 'cricket'
        ? { match_type: 'T20' }
        : (sportId === 'volleyball'
          ? { max_sets: 5 }
          : (sportId === 'football'
            ? { match_minutes: 90 }
            : (isRacketSport ? { category: 'Mens Singles' } : {})))
  });
  const [scheduledLocal, setScheduledLocal] = useState('');
  const scheduledInputRef = useRef(null);

  const meta = getSportMeta(sportId);

  useEffect(() => {
    const nextScoreDetail =
      sportId === 'cricket'
        ? { match_type: 'T20' }
        : (sportId === 'volleyball'
          ? { max_sets: 5 }
          : (sportId === 'football'
            ? { match_minutes: 90 }
            : (RACKET_SPORTS.includes(sportId) ? { category: 'Mens Singles' } : {})));

    setNewMatch({
      sport_id: sportId,
      team1_id: '',
      team2_id: '',
      scheduled_time: '',
      score_detail: nextScoreDetail,
    });
    setScheduledLocal('');

    if (authLoading) return;
    if (!user) {
      navigate('/login', { replace: true });
      return;
    }
    const fetchTeams = async () => {
      try {
        const res = await api.get(`/teams/sport/${sportId}`);
        setTeams(res.data);
      } catch (e) {
        console.error("Failed to fetch teams", e);
      }
    };
    fetchTeams();
  }, [user, authLoading, navigate, sportId]);

  const selectedCategory = newMatch.score_detail?.category || 'Mens Singles';
  const categoryFilteredTeams = isRacketSport
    ? teams.filter((t) => (t.category || '') === selectedCategory)
    : teams;

  if (authLoading) {
    return <div className="container"><p style={{ color: 'var(--color-text-muted)' }}>Checking admin session…</p></div>;
  }

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newMatch.team1_id || !newMatch.team2_id) {
      alert("Please select both teams.");
      return;
    }

    if (isRacketSport) {
      const team1 = teams.find((t) => String(t.id) === String(newMatch.team1_id));
      const team2 = teams.find((t) => String(t.id) === String(newMatch.team2_id));
      if (!team1 || !team2) {
        alert('Please select valid teams.');
        return;
      }
      if ((team1.category || '') !== selectedCategory || (team2.category || '') !== selectedCategory) {
        alert('For badminton/table-tennis, both teams must belong to the selected subcategory.');
        return;
      }
    }

    try {
      await api.post('/matches', newMatch);
      navigate('/admin');
    } catch (e) {
      alert('Error creating match: ' + (e.response?.data?.detail || e.message));
    }
  };

  const handleScoreDetailChange = (field, value) => {
    setNewMatch(prev => ({
      ...prev,
      score_detail: {
        ...prev.score_detail,
        [field]: value
      }
    }));
  };

  const openDateTimePicker = () => {
    const input = scheduledInputRef.current;
    if (!input) return;
    input.focus();
    if (typeof input.showPicker === 'function') {
      try {
        input.showPicker();
      } catch {
        // Fallback for browsers that block showPicker unless triggered in specific contexts.
      }
    }
  };

  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title">Create {meta.name} Match</h1>
      </div>
      
      <div className="card" style={{ maxWidth: '600px', margin: '0 auto' }}>
        <form onSubmit={handleCreate}>
          {isRacketSport && (
            <div className="input-group">
              <label className="input-label">Subcategory</label>
              <select
                className="input-field"
                value={selectedCategory}
                onChange={(e) => {
                  const category = e.target.value;
                  setNewMatch((prev) => ({
                    ...prev,
                    team1_id: '',
                    team2_id: '',
                    score_detail: {
                      ...(prev.score_detail || {}),
                      category,
                    },
                  }));
                }}
              >
                {RACKET_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          )}

          <div style={{ display: 'flex', gap: '1rem' }}>
            <div className="input-group" style={{ flex: 1 }}>
              <label className="input-label">Team 1</label>
              <select
                className="input-field"
                value={newMatch.team1_id}
                onChange={e => setNewMatch({ ...newMatch, team1_id: e.target.value })}
                required
              >
                <option value="">Select</option>
                {categoryFilteredTeams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            
            <div className="input-group" style={{ flex: 1 }}>
              <label className="input-label">Team 2</label>
              <select
                className="input-field"
                value={newMatch.team2_id}
                onChange={e => setNewMatch({ ...newMatch, team2_id: e.target.value })}
                required
              >
                <option value="">Select</option>
                {categoryFilteredTeams
                  .filter(t => String(t.id) !== String(newMatch.team1_id))
                  .map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </div>

          {isRacketSport && categoryFilteredTeams.length < 2 && (
            <p style={{ color: 'var(--color-text-muted)', marginTop: '0.25rem', marginBottom: '1rem', fontSize: '0.9rem' }}>
              Need at least two teams in {selectedCategory} to schedule this match.
            </p>
          )}

          <div className="input-group">
            <label className="input-label">Scheduled Time (Local)</label>
            <div
              className="datetime-field-shell"
              onClick={openDateTimePicker}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  openDateTimePicker();
                }
              }}
              role="button"
              tabIndex={0}
              aria-label="Open date and time picker"
            >
              <input
                ref={scheduledInputRef}
                type="datetime-local"
                className="input-field"
                value={scheduledLocal}
                onClick={openDateTimePicker}
                onChange={(e) => {
                  const value = e.target.value;
                  setScheduledLocal(value);
                  setNewMatch({
                    ...newMatch,
                    scheduled_time: value ? new Date(value).toISOString() : ''
                  });
                }}
                required
              />
              <span className="datetime-picker-icon" aria-hidden="true">🗓</span>
            </div>
          </div>

          {/* CRICKET SPECIFIC CONFIGS */}
          {sportId === 'cricket' && (
            <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', marginBottom: '1.5rem', border: '1px solid rgba(255,255,255,0.1)' }}>
              <h3 style={{ margin: '0 0 1rem', fontSize: '1rem' }}>Cricket specific settings</h3>
              <div className="input-group">
                <label className="input-label">Match Type</label>
                <select className="input-field" onChange={e => handleScoreDetailChange('match_type', e.target.value)} value={newMatch.score_detail.match_type || 'T20'}>
                  <option value="T20">T20 (20 Overs)</option>
                  <option value="ODI">ODI (50 Overs)</option>
                  <option value="T10">T10 (10 Overs)</option>
                  <option value="Test">Test Match</option>
                  <option value="Custom">Custom</option>
                </select>
              </div>
              {newMatch.score_detail.match_type === 'Custom' && (
                <div className="input-group">
                  <label className="input-label">Custom Overs Limit</label>
                  <input 
                    type="number" 
                    className="input-field" 
                    placeholder="e.g. 5" 
                    onChange={e => handleScoreDetailChange('custom_overs', parseInt(e.target.value, 10))}
                  />
                </div>
              )}
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label className="input-label">Venue / Stadium</label>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="Enter stadium name" 
                  onChange={e => handleScoreDetailChange('venue', e.target.value)}
                />
              </div>
            </div>
          )}

          {/* VOLLEYBALL SPECIFIC CONFIGS */}
          {sportId === 'volleyball' && (
            <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', marginBottom: '1.5rem', border: '1px solid rgba(255,255,255,0.1)' }}>
              <h3 style={{ margin: '0 0 1rem', fontSize: '1rem' }}>Volleyball specific settings</h3>
              <div className="input-group">
                <label className="input-label">Number of Sets</label>
                <select className="input-field" onChange={e => handleScoreDetailChange('max_sets', parseInt(e.target.value, 10))} value={newMatch.score_detail.max_sets || 5}>
                  <option value={3}>Best of 3</option>
                  <option value={5}>Best of 5</option>
                  <option value={1}>Single Set</option>
                </select>
              </div>
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label className="input-label">Venue / Stadium</label>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="Enter stadium name" 
                  onChange={e => handleScoreDetailChange('venue', e.target.value)}
                />
              </div>
            </div>
          )}

          {/* FOOTBALL SPECIFIC CONFIGS */}
          {sportId === 'football' && (
            <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', marginBottom: '1.5rem', border: '1px solid rgba(255,255,255,0.1)' }}>
              <h3 style={{ margin: '0 0 1rem', fontSize: '1rem' }}>Football specific settings</h3>
              <div className="input-group">
                <label className="input-label">Match Duration (minutes)</label>
                <select
                  className="input-field"
                  onChange={e => handleScoreDetailChange('match_minutes', parseInt(e.target.value, 10))}
                  value={newMatch.score_detail.match_minutes || 90}
                >
                  <option value={90}>90 mins (standard)</option>
                  <option value={80}>80 mins</option>
                  <option value={70}>70 mins</option>
                  <option value={60}>60 mins</option>
                </select>
              </div>
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label className="input-label">Venue / Stadium</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Enter stadium name"
                  onChange={e => handleScoreDetailChange('venue', e.target.value)}
                />
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
            <button type="button" className="btn-outline" onClick={() => navigate('/admin')} style={{ flex: 1 }}>Cancel</button>
            <button type="submit" className="btn-primary" style={{ flex: 2 }}>Create Match</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AdminCreateMatch;
