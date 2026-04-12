import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import api from '../api';
import { getSportMeta } from '../sports/sportsConfig';

function AdminCreateMatch() {
  const { sportId } = useParams();
  const navigate = useNavigate();
  const { user, authLoading } = useAuth();
  
  const [teams, setTeams] = useState([]);
  const [newMatch, setNewMatch] = useState({
    sport_id: sportId,
    team1_id: '',
    team2_id: '',
    scheduled_time: '',
    score_detail: sportId === 'cricket' ? { match_type: 'T20' } : (sportId === 'volleyball' ? { max_sets: 5 } : {})
  });

  const meta = getSportMeta(sportId);

  useEffect(() => {
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

  if (authLoading) {
    return <div className="container"><p style={{ color: 'var(--color-text-muted)' }}>Checking admin session…</p></div>;
  }

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newMatch.team1_id || !newMatch.team2_id) {
      alert("Please select both teams.");
      return;
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

  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title">Create {meta.name} Match</h1>
      </div>
      
      <div className="card" style={{ maxWidth: '600px', margin: '0 auto' }}>
        <form onSubmit={handleCreate}>
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
                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
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
                {teams
                  .filter(t => String(t.id) !== String(newMatch.team1_id))
                  .map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </div>

          <div className="input-group">
            <label className="input-label">Scheduled Time (Local)</label>
            <input 
              type="datetime-local" 
              className="input-field" 
              onChange={e => setNewMatch({...newMatch, scheduled_time: new Date(e.target.value).toISOString()})} 
              required 
            />
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
