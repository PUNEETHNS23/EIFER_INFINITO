import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/useAuth';

export default function AdminTournamentMatchEdit() {
  const { tournamentId, matchUid } = useParams();
  const navigate = useNavigate();
  const { user, authLoading } = useAuth();

  const [tournament, setTournament] = useState(null);
  const [match, setMatch] = useState(null);
  const [allTeams, setAllTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form states
  const [scheduledAt, setScheduledAt] = useState('');
  const [venue, setVenue] = useState('');
  const [teamAId, setTeamAId] = useState('');   // '' = no change, 'BYE' = null, or numeric id
  const [teamBId, setTeamBId] = useState('');

  useEffect(() => {
    if (authLoading || !user) return;

    const fetchData = async () => {
      try {
        const res = await api.get(`/tournaments/${tournamentId}`);
        const t = res.data;
        setTournament(t);

        // Find the match in the bracket
        let foundMatch = null;
        for (const round of (t.bracket || [])) {
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
          setTeamAId('keep');
          setTeamBId('keep');
        }

        // Collect all unique teams from the entire bracket
        const teamMap = new Map();
        for (const round of (t.bracket || [])) {
          for (const m of round) {
            if (m.teamA?.id) teamMap.set(m.teamA.id, m.teamA);
            if (m.teamB?.id) teamMap.set(m.teamB.id, m.teamB);
          }
        }
        setAllTeams(Array.from(teamMap.values()).sort((a, b) => a.name.localeCompare(b.name)));
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
      const payload = {
        match_uid: matchUid,
        scheduled_at: scheduledAt || null,
        venue: venue || null,
      };

      // Only include team overrides if admin explicitly chose something
      if (teamAId !== 'keep') {
        payload.teamA_id = teamAId === 'BYE' ? null : parseInt(teamAId, 10);
      }
      if (teamBId !== 'keep') {
        payload.teamB_id = teamBId === 'BYE' ? null : parseInt(teamBId, 10);
      }

      await api.post(`/tournaments/${tournamentId}/set-details`, payload);
      navigate(-1);
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to update match');
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || loading) return (
    <div className="container" style={{ padding: '4rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
      Loading match data…
    </div>
  );
  if (!user) return null;
  if (!match) return (
    <div className="container" style={{ padding: '4rem', textAlign: 'center' }}>Match not found.</div>
  );

  const isDecided = !!match.winner;
  const matchLabel = matchUid.replace(/^r(\d+)m(\d+)$/, 'Round $1, Match $2').replace('3rd_place', '3rd Place');

  return (
    <div className="container" style={{ paddingTop: '2rem', paddingBottom: '5rem' }}>
      <div style={{ marginBottom: '2rem' }}>
        <button onClick={() => navigate(-1)} className="btn-outline btn-sm">← Back to Bracket</button>
      </div>

      <div className="card" style={{ maxWidth: '600px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <h2 style={{ margin: '0 0 0.4rem', fontSize: '1.5rem', fontWeight: 900 }}>
            ⚙️ Edit Match
          </h2>
          <p style={{ color: 'var(--color-text-muted)', margin: 0, fontSize: '0.9rem' }}>
            <strong style={{ color: 'var(--color-primary)' }}>{matchLabel}</strong>
            &nbsp;·&nbsp;{tournament?.name}
          </p>
          {isDecided && (
            <div style={{
              marginTop: '1rem', padding: '0.7rem 1rem', borderRadius: 10,
              background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.3)',
              fontSize: '0.85rem', color: '#34d399', display: 'flex', alignItems: 'center', gap: '0.5rem'
            }}>
              🏆 Winner: <strong>{match.winner?.name}</strong> — team slots cannot be changed.
            </div>
          )}
        </div>

        {/* Current match-up preview */}
        <div style={{
          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 12, padding: '1rem', marginBottom: '1.5rem',
          display: 'flex', alignItems: 'center', justifyContent: 'space-around', gap: '1rem'
        }}>
          <div style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)', marginBottom: 4 }}>Team A</div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: match.teamA ? 'var(--color-text)' : 'var(--color-text-muted)', fontStyle: match.teamA ? 'normal' : 'italic' }}>
              {match.teamA?.name || 'TBD'}
            </div>
          </div>
          <div style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--color-primary)', opacity: 0.6 }}>VS</div>
          <div style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)', marginBottom: 4 }}>Team B</div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: match.teamB ? 'var(--color-text)' : 'var(--color-text-muted)', fontStyle: match.teamB ? 'normal' : 'italic' }}>
              {match.teamB?.name || (match.teamA && !match.teamB ? 'BYE' : 'TBD')}
            </div>
          </div>
        </div>

        <form onSubmit={handleSave}>
          {/* Schedule */}
          <div className="input-group">
            <label className="input-label">📅 Date &amp; Time</label>
            <input
              type="datetime-local"
              className="input-field"
              value={scheduledAt}
              onChange={e => setScheduledAt(e.target.value)}
            />
          </div>

          {/* Venue */}
          <div className="input-group">
            <label className="input-label">📍 Venue / Court</label>
            <input
              type="text"
              className="input-field"
              placeholder="e.g. Court 1, Ground A"
              value={venue}
              onChange={e => setVenue(e.target.value)}
            />
          </div>

          {/* Team A override */}
          {!isDecided && (
            <div className="input-group">
              <label className="input-label">
                🔄 Override Team A Slot
                <span style={{ fontWeight: 400, color: 'var(--color-text-muted)', marginLeft: 6, fontSize: '0.8rem' }}>(optional)</span>
              </label>
              <select
                className="input-field"
                value={teamAId}
                onChange={e => setTeamAId(e.target.value)}
              >
                <option value="keep">— Keep current ({match.teamA?.name || 'TBD'}) —</option>
                <option value="BYE">⛔ BYE / Empty</option>
                {allTeams.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name}{match.teamA?.id === t.id ? ' ✓' : ''}
                  </option>
                ))}
              </select>
              <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: '0.4rem 0 0' }}>
                Changing teams will propagate to any downstream matches where this team was already placed.
              </p>
            </div>
          )}

          {/* Team B override */}
          {!isDecided && (
            <div className="input-group">
              <label className="input-label">
                🔄 Override Team B Slot
                <span style={{ fontWeight: 400, color: 'var(--color-text-muted)', marginLeft: 6, fontSize: '0.8rem' }}>(optional)</span>
              </label>
              <select
                className="input-field"
                value={teamBId}
                onChange={e => setTeamBId(e.target.value)}
              >
                <option value="keep">— Keep current ({match.teamB?.name || (match.teamA ? 'BYE' : 'TBD')}) —</option>
                <option value="BYE">⛔ BYE / Empty</option>
                {allTeams.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name}{match.teamB?.id === t.id ? ' ✓' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
            <button
              type="submit"
              className="btn-primary"
              style={{ flex: 1 }}
              disabled={saving}
            >
              {saving ? 'Saving…' : '✅ Save Changes'}
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
