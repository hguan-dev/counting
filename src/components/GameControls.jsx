export default function GameControls({
  gameState,
  spotBets,
  setSpotBet,
  numHands,
  setNumHands,
  onDeal,
  onHit,
  onStand,
  onDouble,
  onSplit,
  canDouble,
  canSplit,
  canResplit,
  onInsurance,
  onNextRound,
  lastHeard,
  onToggleVoiceInput,
  voiceInputEnabled,
  voiceError,
  voiceStatus,
  voiceSupported,
}) {
  return (
    <div className="game-controls" aria-label="Game controls">
      {gameState === 'betting' && (
        <div className="betting-controls">
          <label className="control-field" htmlFor="spots">
            <span>Player spots</span>
            <select id="spots" aria-label="Number of spots" value={numHands} onChange={(e) => setNumHands(Number(e.target.value))}>
              <option value={1}>1 spot</option>
              <option value={2}>2 spots</option>
            </select>
          </label>
          {Array.from({ length: numHands }, (_, spotIndex) => (
            <label className="control-field" htmlFor={`wager-${spotIndex + 1}`} key={spotIndex}>
              <span>Spot {spotIndex + 1} wager</span>
              <span className="control-input has-prefix">
                <b>$</b>
                <input
                  id={`wager-${spotIndex + 1}`}
                  aria-label={`Spot ${spotIndex + 1} wager amount`}
                  type="number"
                  value={spotBets[spotIndex]}
                  onChange={(event) => setSpotBet(spotIndex, Number(event.target.value))}
                  step="5"
                  min="5"
                  max="10000"
                />
              </span>
            </label>
          ))}
          <button className="deal-button" onClick={onDeal}>
            <span>Deal cards</span>
            <small>${spotBets.slice(0, numHands).reduce((sum, bet) => sum + bet, 0)} total</small>
          </button>
        </div>
      )}

      {gameState === 'insurance' && (
        <div className="insurance-controls">
          <div className="decision-copy">
            <span className="decision-kicker">Dealer shows an Ace</span>
            <strong>Insure eligible hands?</strong>
            <small>Costs half each eligible spot’s wager. Pays 2:1 only if the dealer has blackjack.</small>
          </div>
          <button className="decision-button is-gold" onClick={() => onInsurance(true)}>Buy insurance</button>
          <button className="decision-button" onClick={() => onInsurance(false)}>No insurance</button>
        </div>
      )}

      {gameState === 'playing' && (
        <div className="action-cluster">
          <button className="action-button is-hit" onClick={onHit}><span>Hit</span></button>
          <button className="action-button is-stand" onClick={onStand}><span>Stand</span></button>
          {canDouble && <button className="action-button is-double" onClick={onDouble}><span>Double</span></button>}
          {canSplit && <button className="action-button is-split" onClick={onSplit}><span>{canResplit ? 'Resplit' : 'Split'}</span></button>}
          <button
            className={`voice-action ${voiceInputEnabled ? 'is-on' : ''} ${['starting', 'listening', 'hearing', 'processing'].includes(voiceStatus) ? 'is-listening' : ''}`}
            onClick={onToggleVoiceInput}
            disabled={!voiceSupported}
            aria-pressed={voiceInputEnabled}
          >
            <span className="mic-icon" aria-hidden="true">●</span>
            <span>
              {voiceSupported
                ? voiceStatus === 'blocked'
                  ? 'Microphone blocked'
                  : voiceStatus === 'error'
                    ? 'Microphone needs attention'
                    : voiceStatus === 'hearing'
                      ? 'Hearing you…'
                      : voiceStatus === 'processing'
                        ? 'Matching command…'
                        : ['starting', 'listening'].includes(voiceStatus)
                    ? 'Listening…'
                    : voiceInputEnabled ? 'Voice commands on' : 'Enable voice commands'
                : 'Voice commands unavailable'}
              <small>{voiceError || (lastHeard ? `Heard: “${lastHeard}”` : 'Say “microphone test” to check recognition')}</small>
            </span>
          </button>
        </div>
      )}

      {(gameState === 'resolved' || gameState === 'dealerRevealing' || gameState === 'shuffling') && gameState !== 'insurance' && gameState !== 'playing' && gameState !== 'betting' && (
        <button className="next-round-button" onClick={onNextRound} disabled={gameState === 'dealerRevealing' || gameState === 'shuffling'}>
          {gameState === 'shuffling' ? 'Shuffling shoe…' : gameState === 'dealerRevealing' ? 'Dealer revealing…' : 'Deal next round'}
        </button>
      )}
    </div>
  );
}
