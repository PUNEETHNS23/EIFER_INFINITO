import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/useAuth';

export default function AdminTournamentMatchEdit() {
  const { tournamentId, matchUid } = useParams();
  const navigate = useNavigate();
  const { user, authLoading } = useAuth();

  const [tournament, setTournament] = useState(null);
  const [match, setMatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form states
  const [scheduledAt, setScheduledAt] = useState('');
  const [venue, setVenue] = useState('');

  useEffect(() => {
    if (authLoading || !user) return;
    
    const fetchData = async () => {
      try {
        const res = await api.get(`/tournaments/${tournamentId}`);
        setTournament(res.data);
        
        // Find the match in the bracket
        let foundMatch = null;
        for (const round of (res.data.bracket || [])) {
          for (const m of round) {
            if (m.uid === matchUid) {
              foundMatch = m;
              break;
            }
          }
          if (foundMatch) break;
        }

        if (foundMatch) {
          setMatch(foundMatch);
          setScheduledAt(foundMatch.scheduled_at ? foundMatch.scheduled_at.slice(0, 16) : '');
          setVenue(foundMatch.venue || '');
        }
      } catch (err) {
        console.error('Failed to load match details', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [tournamentId, matchUid, user, authLoading]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(`/tournaments/${tournamentId}/set-details`, {
        match_uid: matchUid,
        scheduled_at: scheduledAt || null,
        venue: venue || null
      });
      navigate('/admin/tournament');
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to update match');
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || loading) return <div className="container" style={{ padding: '4rem', textAlign: 'center' }}>Loading...</div>;
  if (!user) return null;
  if (!match) return <div className="container" style={{ padding: '4rem', textAlign: 'center' }}>Match not found.</div>;

  return (
    <div className="container" style={{ paddingTop: '2rem', paddingBottom: '5rem' }}>
      <div style={{ marginBottom: '2rem' }}>
        <button onClick={() => navigate(-1)} className="btn-outline btn-sm">← Back</button>
      </div>

      <div className="card" style={{ maxWidth: '600px', margin: '0 auto' }}>
        <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.5rem', fontWeight: 900 }}>Edit Match Schedule</h2>
        <p style={{ color: 'var(--color-text-muted)', marginBottom: '2rem' }}>
          Update the time and venue for match <strong>{matchUid.replace('r', 'Round ').replace('m', ' Match ')}</strong> in <strong>{tournament.name}</strong>.
        </p>

        <form onSubmit={handleSave}>
          <div className="input-group">
            <label className="input-label">Date & Time</label>
            <input 
              type="datetime-local" 
              className="input-field" 
              value={scheduledAt}
              onChange={e => setScheduledAt(e.target.value)}
            />
          </div>

          <div className="input-group">
            <label className="input-label">Venue / Court</label>
            <input 
              type="text" 
              className="input-field" 
              placeholder="e.g. Court 1, Ground A"
              value={venue}
              onChange={e => setVenue(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
            <button 
              type="submit" 
              className="btn-primary" 
              style={{ flex: 1 }}
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            <button 
              type="button" 
              className="btn-outline" 
              style={{ flex: 1 }}
              onClick={() => navigate(-1)}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
