import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import api from '../api';
import { getSportMeta, CATEGORY_SPORTS, getSportCategories } from '../sports/sportsConfig';

function AdminCreateMatch() {
  const { sportId } = useParams();
  const navigate = useNavigate();
  const { user, authLoading } = useAuth();
  const allowedSports = user?.allowed_sports || [];
  const canAccessSport = allowedSports.length === 0 || allowedSports.includes(sportId);
  const categorizedSports = Object.keys(CATEGORY_SPORTS);
  const isCategorizedSport = categorizedSports.includes(sportId);
  
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
            : (isCategorizedSport ? { category: getSportCategories(sportId)[0] } : {})))
  });
  const [scheduledLocal, setScheduledLocal] = useState('');
  const [participantCount, setParticipantCount] = useState(4);
  const [qualifierCount, setQualifierCount] = useState(2);
  const [selectedTeamIds, setSelectedTeamIds] = useState([]);
  const [allMatches, setAllMatches] = useState([]);
  const [onlyQualified, setOnlyQualified] = useState(false);
  const [eventType, setEventType] = useState('boys_100m');
  const [isFinal, setIsFinal] = useState(false);
  const scheduledInputRef = useRef(null);

  const ATHLETICS_EVENTS = [
    { value: 'boys_100m', label: 'Boys 100m' },
    { value: 'girls_100m', label: 'Girls 100m' },
    { value: 'relay_4x100', label: '4 × 100m Relay' },
  ];

  const meta = getSportMeta(sportId);
  useEffect(() => {
    const nextScoreDetail =
      sportId === 'cricket'
        ? { match_type: 'T20' }
        : (sportId === 'volleyball'
          ? { max_sets: 5 }
          : (sportId === 'football'
            ? { match_minutes: 90 }
            : (categorizedSports.includes(sportId) ? { category: getSportCategories(sportId)[0] } : {})));

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
    if (!canAccessSport) {
      navigate('/admin', { replace: true });
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
    const fetchMatches = async () => {
      try {
        const res = await api.get(`/matches/sport/${sportId}`);
        setAllMatches(res.data);
      } catch (e) {
        console.error("Failed to fetch matches", e);
      }
    };
    fetchTeams();
    fetchMatches();
  }, [user, authLoading, navigate, sportId, canAccessSport, categorizedSports]);

  const selectedCategory = newMatch.score_detail?.category || (isCategorizedSport ? getSportCategories(sportId)[0] : '');
  const categoryFilteredTeams = isCategorizedSport
    ? teams.filter((t) => (t.category || '') === selectedCategory)
    : teams;
  if (authLoading) {
    return <div className="container"><p style={{ color: 'var(--color-text-muted)' }}>Checking admin session…</p></div>;
  }

  if (!canAccessSport) {
    return <Navigate to="/admin" replace />;
  }


  const handleCreate = async (e) => {
    e.preventDefault();
    if (sportId === 'athletics') {
      const filledIds = selectedTeamIds.filter(Boolean);
      if (filledIds.length < participantCount) {
        alert(`Please select all ${participantCount} participants.`);
        return;
      }
      if (qualifierCount > participantCount) {
        alert('Qualifiers cannot exceed number of participants.');
        return;
      }
      // Build the full score_detail for this athletics match
      const athleticsDetail = {
        event_type: eventType,
        is_final: isFinal,
        participant_count: participantCount,
        qualifier_count: qualifierCount,
        participants: filledIds.map(id => ({
          team_id: id,
          rank: null,
          time: null,
          qualified: false,
        })),
      };
      newMatch.score_detail = athleticsDetail;
      newMatch.team1_id = filledIds[0];
      newMatch.team2_id = filledIds[1];
    } else {
      if (!newMatch.team1_id || !newMatch.team2_id) {
        alert("Please select both teams.");
        return;
      }
    }


    if (isCategorizedSport && sportId !== 'athletics') {
      const team1 = teams.find((t) => String(t.id) === String(newMatch.team1_id));
      const team2 = teams.find((t) => String(t.id) === String(newMatch.team2_id));
      if (!team1 || !team2) {
        alert('Please select valid teams.');
        return;
      }
      if ((team1.category || '') !== selectedCategory || (team2.category || '') !== selectedCategory) {
        alert('For this sport, both teams must belong to the selected subcategory.');
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
          {isCategorizedSport && (
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
                {getSportCategories(sportId).map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          )}

          {sportId === 'athletics' ? (
            <>
              {/* Athletics Match Setup */}
              <div style={{ padding: '1.25rem', background: 'rgba(255,255,255,0.04)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', marginBottom: '1.5rem' }}>
                <h3 style={{ margin: '0 0 1.25rem', fontSize: '0.95rem', color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>🏃 Athletics Match Settings</h3>

                <div className="input-group">
                  <label className="input-label">Event Type</label>
                  <select
                    className="input-field"
                    value={eventType}
                    onChange={e => setEventType(e.target.value)}
                    required
                  >
                    {ATHLETICS_EVENTS.map(ev => (
                      <option key={ev.value} value={ev.value}>{ev.label}</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="input-group">
                    <label className="input-label">Number of Participants</label>
                    <input
                      type="number" min="2" max="16"
                      className="input-field"
                      value={participantCount}
                      onChange={e => {
                        const count = Math.max(2, parseInt(e.target.value) || 2);
                        setParticipantCount(count);
                        setQualifierCount(prev => Math.min(prev, count));
                        setSelectedTeamIds(prev => prev.slice(0, count));
                      }}
                    />
                  </div>
                  <div className="input-group">
                    <label className="input-label">Number of Qualifiers</label>
                    <input
                      type="number" min="1" max={participantCount}
                      className="input-field"
                      value={qualifierCount}
                      onChange={e => setQualifierCount(Math.min(participantCount, Math.max(1, parseInt(e.target.value) || 1)))}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem', padding: '0.6rem 1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                  <input
                    type="checkbox" id="is-final" checked={isFinal}
                    onChange={e => setIsFinal(e.target.checked)}
                    style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                  />
                  <label htmlFor="is-final" style={{ fontSize: '0.9rem', cursor: 'pointer' }}>
                    {isFinal ? '🏆 This is the Final (winners get leaderboard points)' : 'Mark as Final Match'}
                  </label>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Select Participants</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input
                      type="checkbox" id="qualified-only" checked={onlyQualified}
                      onChange={e => { setOnlyQualified(e.target.checked); setSelectedTeamIds([]); }}
                      style={{ width: '15px', height: '15px', cursor: 'pointer' }}
                    />
                    <label htmlFor="qualified-only" style={{ fontSize: '0.8rem', cursor: 'pointer', color: onlyQualified ? 'var(--color-primary)' : 'var(--color-text-muted)' }}>Qualified Teams Only</label>
                  </div>
                </div>

                {onlyQualified && (() => {
                  const qualifiedIds = new Set(
                    allMatches
                      .filter(m => m.score_detail?.event_type === eventType)
                      .flatMap(m => (m.score_detail?.participants || [])
                        .filter(p => p.qualified)
                        .map(p => String(p.team_id))
                      )
                  );
                  if (qualifiedIds.size === 0) {
                    return <p style={{ fontSize: '0.85rem', color: '#f59e0b', marginBottom: '1rem' }}>⚠️ No qualified teams found for this event type yet. Disable the toggle to select freely.</p>;
                  }
                  return null;
                })()}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  {Array.from({ length: participantCount }).map((_, idx) => {
                    const qualifiedSet = onlyQualified ? new Set(
                      allMatches
                        .filter(m => m.score_detail?.event_type === eventType)
                        .flatMap(m => (m.score_detail?.participants || [])
                          .filter(p => p.qualified)
                          .map(p => String(p.team_id))
                        )
                    ) : null;
                    const available = teams.filter(t =>
                      (!qualifiedSet || qualifiedSet.has(String(t.id))) &&
                      (!selectedTeamIds.includes(String(t.id)) || String(t.id) === String(selectedTeamIds[idx]))
                    );
                    return (
                      <div key={idx} className="input-group" style={{ marginBottom: 0 }}>
                        <label className="input-label">Participant {idx + 1}</label>
                        <select
                          className="input-field"
                          value={selectedTeamIds[idx] || ''}
                          onChange={e => {
                            const next = [...selectedTeamIds];
                            next[idx] = e.target.value;
                            setSelectedTeamIds(next);
                          }}
                          required
                        >
                          <option value="">Select team</option>
                          {available.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                      </div>
                    );
                  })}
                </div>

                <p style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                  Top {qualifierCount} team{qualifierCount !== 1 ? 's' : ''} will be marked as qualified per match.
                </p>
              </div>
            </>
          ) : (
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
          )}

          {isCategorizedSport && categoryFilteredTeams.length < 2 && (
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
