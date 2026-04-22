import { useCallback, useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api';
import { SPORTS } from '../sports/sportsConfig';
import BracketView from '../components/BracketView';

export default function TournamentBracketView() {
  const { tournamentId } = useParams();
  const [tournament, setTournament] = useState(null);
  const [loading,    setLoading]    = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await api.get(`/tournaments/${tournamentId}`);
      setTournament(res.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [tournamentId]);

  useEffect(() => {
    load();
    const iv = setInterval(load, 30000);
    return () => clearInterval(iv);
  }, [load]);

  const sp = tournament ? SPORTS.find(s => s.id === tournament.sport_id) : null;
  const champion = tournament?.bracket?.at(-1)?.[0]?.winner;

  return (
    <div className="container" style={{ paddingTop: '2rem', paddingBottom: '4rem' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <Link to="/" className="btn-outline btn-sm">← Home</Link>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--color-text-muted)' }}>Loading bracket…</div>
      ) : !tournament ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: '#ef4444' }}>Tournament not found.</div>
      ) : (
        <>
          {/* Hero */}
          <div style={{
            background: 'linear-gradient(135deg,rgba(99,102,241,0.12),rgba(245,158,11,0.08))',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 20, padding: '2.5rem 2rem', textAlign: 'center', marginBottom: '2rem',
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>{sp?.icon || '🏆'}</div>
            <h1 style={{ margin: '0 0 0.5rem', fontSize: '2.2rem', fontWeight: 900 }}>{tournament.name}</h1>
            <p style={{ color: 'var(--color-text-muted)', margin: '0 0 1rem', fontSize: '1rem', textTransform: 'capitalize' }}>
              {tournament.sport_id}{tournament.category ? ` · ${tournament.category}` : ''} · Single Elimination
            </p>
            <span style={{
              display: 'inline-block', padding: '0.5rem 1.5rem', borderRadius: 999,
              fontSize: '0.85rem', fontWeight: 800,
              background: tournament.status === 'completed' ? 'rgba(52,211,153,0.15)' : 'rgba(245,158,11,0.15)',
              color: tournament.status === 'completed' ? '#34d399' : '#f59e0b',
              border: `1px solid ${tournament.status === 'completed' ? 'rgba(52,211,153,0.3)' : 'rgba(245,158,11,0.3)'}`,
            }}>
              {tournament.status === 'completed' ? '🏆 Tournament Concluded' : '⚡ In Progress'}
            </span>
          </div>

          {/* Champion banner */}
          {champion && (
            <div style={{
              background: 'linear-gradient(135deg,rgba(245,158,11,0.2),rgba(217,119,6,0.1))',
              border: '1px solid rgba(245,158,11,0.4)', borderRadius: 16,
              padding: '1.5rem 2rem', marginBottom: '2.5rem',
              display: 'flex', alignItems: 'center', gap: '1.5rem',
            }}>
              <div style={{ fontSize: '3.5rem' }}>🏆</div>
              <div>
                <div style={{ fontSize: '0.8rem', color: '#f59e0b', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  Tournament Champion
                </div>
                <div style={{ fontSize: '2rem', fontWeight: 900, marginTop: '0.2rem' }}>{champion.name}</div>
              </div>
            </div>
          )}

          {/* Bracket */}
          <div className="card" style={{ padding: '2rem' }}>
            <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontSize: '1.5rem' }}>📊</span>
                <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 900 }}>Live Tournament Bracket</h2>
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', background: 'rgba(255,255,255,0.05)', padding: '4px 12px', borderRadius: 8 }}>
                Refreshes every 30s
              </span>
            </div>
            <BracketView rounds={tournament.bracket || []} />
          </div>
        </>
      )}
    </div>
  );
}
