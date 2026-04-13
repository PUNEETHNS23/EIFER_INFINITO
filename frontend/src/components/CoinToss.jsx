import React, { useState } from 'react';
import './CoinToss.css';

/**
 * CoinToss Component
 * Handles coin toss for sports like Cricket, Badminton, Table Tennis, Volleyball, etc.
 * 
 * Props:
 * - sportId: string (cricket, badminton, table-tennis, volleyball, kho-kho)
 * - team1Name: string
 * - team2Name: string
 * - onTossComplete: function (tossData) - called with { tossWinner: 't1'|'t2', tossDec ision: 'bat'|'bowl'|etc }
 * - initialTossWinner: string (optional) - pre-fill the toss winner
 * - initialTossDecision: string (optional) - pre-fill the toss decision
 */
function CoinToss({ sportId, team1Name, team2Name, onTossComplete, initialTossWinner, initialTossDecision }) {
  const [isFlipping, setIsFlipping] = useState(false);
  const [tossWinner, setTossWinner] = useState(initialTossWinner || null);
  const [tossDecision, setTossDecision] = useState(initialTossDecision || null);
  const [showDecisionStep, setShowDecisionStep] = useState(!!initialTossWinner);

  // Determine toss decision options based on sport
  const getTossOptions = () => {
    switch (sportId) {
      case 'cricket':
        return [
          { label: 'Bat First', value: 'bat' },
          { label: 'Bowl First', value: 'bowl' },
        ];
      case 'badminton':
      case 'table-tennis':
        return [
          { label: 'Serve First', value: 'serve' },
          { label: 'Receive First', value: 'receive' },
        ];
      case 'kho-kho':
        return [
          { label: 'Chase First', value: 'chase' },
          { label: 'Run First', value: 'run' },
        ];
      case 'volleyball':
        return [
          { label: 'Serve First', value: 'serve' },
          { label: 'Receive First', value: 'receive' },
        ];
      case 'tug-of-war':
        return [
          { label: 'Choose Side A', value: 'sideA' },
          { label: 'Choose Side B', value: 'sideB' },
        ];
      default:
        return [
          { label: 'Option 1', value: 'option1' },
          { label: 'Option 2', value: 'option2' },
        ];
    }
  };

  const handleCoinFlip = () => {
    setIsFlipping(true);
    
    // Simulate coin flip animation (0.8 seconds)
    setTimeout(() => {
      const result = Math.random() < 0.5 ? 't1' : 't2';
      setTossWinner(result);
      setShowDecisionStep(true);
      setIsFlipping(false);
    }, 800);
  };

  const handleDecisionSelect = (decision) => {
    setTossDecision(decision);
    
    // Call onTossComplete immediately after decision is made
    if (onTossComplete) {
      onTossComplete({
        toss_winner: tossWinner,
        toss_decision: decision,
      });
    }
  };

  const tossOptions = getTossOptions();
  const winnerTeam = tossWinner === 't1' ? team1Name : team2Name;
  const sportName = SPORT_NAMES[sportId] || sportId;

  return (
    <div className="coin-toss-container">
      <div className="coin-toss-card">
        <h3 className="coin-toss-title">🪙 Coin Toss</h3>
        
        {!showDecisionStep ? (
          <div className="coin-toss-flip-section">
            <p className="coin-toss-subtitle">Let's flip a coin to decide who goes first!</p>
            
            <button
              onClick={handleCoinFlip}
              disabled={isFlipping}
              className={`coin-flip-button ${isFlipping ? 'flipping' : ''}`}
            >
              <span className={`coin ${isFlipping ? 'spinning' : ''}`}>🪙</span>
              <span className="flip-text">{isFlipping ? 'Flipping...' : 'Flip Coin'}</span>
            </button>

            <div className="coin-teams-display">
              <div className="team-option">
                <span className="team-label">Heads</span>
                <span className="team-name">{team1Name}</span>
              </div>
              <div className="vs-divider">VS</div>
              <div className="team-option">
                <span className="team-label">Tails</span>
                <span className="team-name">{team2Name}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="coin-toss-decision-section">
            <div className="toss-winner-announcement">
              <p className="winner-text">🎉 {winnerTeam} won the toss!</p>
              <p className="decision-prompt">{winnerTeam}, choose your {sportName} option:</p>
            </div>

            <div className="decision-buttons">
              {tossOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => handleDecisionSelect(option.value)}
                  disabled={tossDecision !== null}
                  className={`decision-button ${tossDecision === option.value ? 'selected' : ''}`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {tossDecision && (
              <div className="toss-confirmation">
                <p className="confirmation-text">✓ {winnerTeam} chose to {tossOptions.find(o => o.value === tossDecision)?.label.toLowerCase()}</p>
              </div>
            )}

            <button
              onClick={() => {
                setTossWinner(null);
                setTossDecision(null);
                setShowDecisionStep(false);
              }}
              className="coin-reset-button"
              style={{ marginTop: '1rem' }}
            >
              Start Over
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Sport name mappings for display
const SPORT_NAMES = {
  cricket: 'cricket',
  badminton: 'badminton',
  'table-tennis': 'table tennis',
  volleyball: 'volleyball',
  'kho-kho': 'kho-kho',
  'tug-of-war': 'side',
};

export default CoinToss;
