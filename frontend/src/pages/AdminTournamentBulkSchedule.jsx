import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/useAuth';

export default function AdminTournamentBulkSchedule() {
  const { tournamentId } = useParams();
  const navigate = useNavigate();
  const { user, authLoading } = useAuth();

  const [tournament, setTournament] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Local state for all matches in the bracket
  // Array of { uid, scheduled_at, venue, teamA_name, teamB_name, round_name }
  const [matchUpdates, setMatchUpdates] = useState([]);

  useEffect(() => {
    if (authLoading || !user) return;
    
    const fetchData = async () => {
      try {
        const res = await api.get(`/tournaments/${tournamentId}`);
        setTournament(res.data);
        
        // Flatten the bracket for bulk editing
        const flattened = [];
        const bracket = res.data.bracket || [];
        
        bracket.forEach((round, rIdx) => {
          const roundName = getRoundName(bracket.length, rIdx);
          round.forEach((m) => {
            // Only matches that can have scheduled time (ignore placeholders if necessary, 
            // but usually we want to schedule everything upfront)
            flattened.push({
              uid: m.uid,
              scheduled_at: m.scheduled_at ? m.scheduled_at.slice(0, 16) : '',
              venue: m.venue || '',
              teamA_name: m.teamA?.name || 'TBD',
              teamB_name: m.teamB?.name || 'TBD',
              round_name: roundName,
              position: m.position
            });
          });
        });
        
        setMatchUpdates(flattened);
      } catch (err) {
        console.error('Failed to load tournament details', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [tournamentId, user, authLoading]);

  const getRoundName = (total, idx) => {
    const fromEnd = total - 1 - idx;
    if (fromEnd === 0) return 'Final';
    if (fromEnd === 1) return 'Semifinal';
    if (fromEnd === 2) return 'Quarterfinal';
    return `Round ${idx + 1}`;
  };

  const handleUpdate = (uid, field, value) => {
    setMatchUpdates(prev => prev.map(m => 
      m.uid === uid ? { ...m, [field]: value } : m
    ));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.post(`/tournaments/${tournamentId}/bulk-set-details`, {
        updates: matchUpdates.map(m => ({
          match_uid: m.uid,
          scheduled_at: m.scheduled_at || null,
          venue: m.venue || null
        }))
      });
      alert('Tournament schedule updated successfully!');
      navigate(`/admin/tournament`);
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to update schedule');
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || loading) return <div className="container" style={{ padding: '4rem', textAlign: 'center' }}>Loading...</div>;
  if (!user) return null;
  if (!tournament) return <div className="container" style={{ padding: '4rem', textAlign: 'center' }}>Tournament not found.</div>;

  // Group by round_name for rendering
  const rounds = {};
  matchUpdates.forEach(m => {
    if (!rounds[m.round_name]) rounds[m.round_name] = [];
    rounds[m.round_name].push(m);
  });

  return (
    <div className="container" style={{ paddingTop: '2rem', paddingBottom: '5rem' }}>
      <div style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button onClick={() => navigate(-1)} className="btn-outline btn-sm">← Back</button>
          <h1 className="page-title" style={{ margin: 0 }}>📅 Bulk Scheduling</h1>
        </div>
        <button 
          onClick={handleSave} 
          className="btn-primary" 
          disabled={saving}
          style={{ padding: '0.6rem 2rem' }}
        >
          {saving ? 'Saving...' : 'Save All Changes'}
        </button>
      </div>

      <div className="card" style={{ marginBottom: '2rem' }}>
        <p style={{ margin: 0, color: 'var(--color-text-muted)' }}>
          Tournament: <strong>{tournament.name}</strong> ({tournament.sport_id})
        </p>
      </div>

      {Object.entries(rounds).map(([roundName, matches]) => (
        <div key={roundName} style={{ marginBottom: '3rem' }}>
          <h3 style={{ 
            fontSize: '1.25rem', fontWeight: 900, marginBottom: '1rem', 
            paddingBottom: '0.5rem', borderBottom: '2px solid rgba(255,255,255,0.05)' 
          }}>
            {roundName}
          </h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '1.5rem' }}>
            {matches.map((m) => (
              <div key={m.uid} className="card" style={{ padding: '1.5rem', background: 'rgba(255,255,255,0.02)' }}>
                <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-primary)', fontWeight: 800, textTransform: 'uppercase' }}>
                    Match {m.position}
                  </span>
                  <span style={{ fontSize: '0.9rem', fontWeight: 700 }}>
                    {m.teamA_name} vs {m.teamB_name}
                  </span>
                </div>
                
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <div className="input-group" style={{ flex: 1, marginBottom: 0 }}>
                    <label className="input-label" style={{ fontSize: '0.75rem' }}>Date & Time</label>
                    <input 
                      type="datetime-local" 
                      className="input-field" 
                      value={m.scheduled_at}
                      onChange={e => handleUpdate(m.uid, 'scheduled_at', e.target.value)}
                    />
                  </div>
                  <div className="input-group" style={{ flex: 1, marginBottom: 0 }}>
                    <label className="input-label" style={{ fontSize: '0.75rem' }}>Venue</label>
                    <input 
                      type="text" 
                      className="input-field" 
                      placeholder="Court/Ground"
                      value={m.venue}
                      onChange={e => handleUpdate(m.uid, 'venue', e.target.value)}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      <div style={{ marginTop: '2rem', textAlign: 'center' }}>
        <button 
          onClick={handleSave} 
          className="btn-primary" 
          disabled={saving}
          style={{ padding: '0.8rem 4rem' }}
        >
          {saving ? 'Saving...' : 'Save All Changes'}
        </button>
      </div>
    </div>
  );
}
