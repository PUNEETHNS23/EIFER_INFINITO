import React, { useState, useEffect } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import api from '../api';
import { getSportMeta } from '../sports/sportsConfig';
import SportScoreboard from '../components/SportScoreboard';
import { useMatchSocket } from '../hooks/useMatchSocket';
import './SportDetails.css';

function SportDetails() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const [matches, setMatches] = useState([]);
  const [teams, setTeams] = useState([]);
  const [activeTab, setActiveTab] = useState('matches');
  const [selectedCategory, setSelectedCategory] = useState('');

  const racketSports = ['badminton', 'table-tennis'];
  const racketCategories = ['Mens Singles', 'Mens Doubles', 'Womens Singles', 'Womens Doubles', 'Mixed Doubles'];
  const isRacketSport = racketSports.includes(id);

  const normalizeCategory = (value) => (typeof value === 'string' ? value.trim() : '');
  const initialCategory = isRacketSport ? normalizeCategory(searchParams.get('subcategory')) : '';

  const getMatchRoute = (match) => (
    ['cricket', 'volleyball', 'football'].includes(match.sport_id)
      ? `/match/${match.id}`
      : `/sport/${match.sport_id}`
  );

  const fetchTeamsForSport = async () => {
    try {
      const teamsRes = await api.get(`/teams/sport/${id}`);
      setTeams(teamsRes.data);
    } catch (err) {
      console.error('Failed to fetch sport teams', err);
    }
  };

  useEffect(() => {
    setSelectedCategory(initialCategory);

    const fetchDetails = async () => {
      try {
        const matchesRes = await api.get(`/matches/sport/${id}`);
        setMatches(matchesRes.data);

        await fetchTeamsForSport();
      } catch (err) {
        console.error('Failed to fetch sport details', err);
      }
    };
    fetchDetails();
  }, [id, initialCategory]);

  useMatchSocket((updatedMatch) => {
    if (updatedMatch.sport_id === id) {
      setMatches((prev) => {
        const idx = prev.findIndex((m) => m.id === updatedMatch.id);
        if (idx >= 0) {
          const arr = [...prev];
          arr[idx] = updatedMatch;
          return arr;
        }
        return [...prev, updatedMatch];
      });
      fetchTeamsForSport();
    }
  });

  const meta = getSportMeta(id);
  const filteredMatches = isRacketSport
    ? (selectedCategory
        ? matches.filter((match) => normalizeCategory(match?.score_detail?.category) === selectedCategory)
        : [])
    : matches;

  const filteredTeams = isRacketSport
    ? (selectedCategory
        ? teams.filter((team) => normalizeCategory(team?.category) === selectedCategory)
        : [])
    : teams;

  return (
    <div className="container sport-details-page">
      <div className="sd-hero">
        <div className="sd-hero-icon">{meta.icon}</div>
        <h1 className="sd-hero-title">{meta.name}</h1>
      </div>

      {isRacketSport && (
        <div className="sd-category-selector">
          <h3 className="sd-category-title">Select Subcategory</h3>
          <div className="sd-category-options">
            {racketCategories.map((category) => (
              <button
                key={category}
                className={`sd-category-btn ${selectedCategory === category ? 'active' : ''}`}
                onClick={() => setSelectedCategory(category)}
              >
                {category}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="sd-tabs">
        <button 
          className={`sd-tab-btn ${activeTab === 'matches' ? 'active' : ''}`} 
          onClick={() => setActiveTab('matches')}
        >
          Matches
        </button>
        <button 
          className={`sd-tab-btn ${activeTab === 'teams' ? 'active' : ''}`} 
          onClick={() => setActiveTab('teams')}
        >
          Teams & Leaderboard
        </button>
      </div>

      {activeTab === 'matches' && (
        <div className="live-matches-grid">
          {isRacketSport && !selectedCategory && (
            <div className="empty-state-premium">Select a subcategory to view matches.</div>
          )}

          {filteredMatches.map((match) => {
            const team1Data = teams.find((team) => team.id === match.team1_id) || null;
            const team2Data = teams.find((team) => team.id === match.team2_id) || null;
            const cardContent = (
              <div className={`sd-match-card ${match.status === 'live' ? 'live' : ''}`}>
                <div className="sd-match-header">
                  <span className={`sd-match-status ${match.status === 'live' ? 'live' : ''}`}>
                    {match.status === 'live' ? '● LIVE' : match.status.toUpperCase()}
                  </span>
                  <span>{new Date(match.scheduled_time).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                {isRacketSport && (
                  <div className="sd-match-category-chip">{normalizeCategory(match?.score_detail?.category) || selectedCategory}</div>
                )}
                <SportScoreboard match={match} compact team1Data={team1Data} team2Data={team2Data} />
              </div>
            );

            return (
              <div key={match.id} className="sd-match-card-wrapper">
                <Link to={getMatchRoute(match)} style={{ textDecoration: 'none', color: 'inherit' }}>
                  {cardContent}
                </Link>
              </div>
            );
          })}
          {selectedCategory && filteredMatches.length === 0 && <div className="empty-state-premium">No matches scheduled for {meta.name} - {selectedCategory} yet.</div>}
          {!isRacketSport && matches.length === 0 && <div className="empty-state-premium">No matches scheduled for {meta.name} yet.</div>}
        </div>
      )}

      {activeTab === 'teams' && (
        <div className="sd-table-card">
          <table className="sd-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Team</th>
                <th>Points</th>
              </tr>
            </thead>
            <tbody>
              {/* Note: Dummy sorting by points */}
              {filteredTeams.sort((a, b) => b.points - a.points).map((team, index) => (
                <tr key={team.id}>
                  <td className={`sd-rank-${index + 1}`}>{index + 1}</td>
                  <td className="sd-team-name">{team.name}</td>
                  <td><span className="sd-points-badge">{team.points}</span></td>
                </tr>
              ))}
              {isRacketSport && !selectedCategory && <tr><td colSpan="3" style={{ textAlign: 'center', padding: '2rem' }}>Select a subcategory to view teams.</td></tr>}
              {selectedCategory && filteredTeams.length === 0 && <tr><td colSpan="3" style={{ textAlign: 'center', padding: '2rem' }}>No teams registered for {meta.name} - {selectedCategory}.</td></tr>}
              {!isRacketSport && teams.length === 0 && <tr><td colSpan="3" style={{ textAlign: 'center', padding: '2rem' }}>No teams registered for {meta.name}.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default SportDetails;
