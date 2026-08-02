export default function GameControls({
  gameState,
  initialBet,
  setInitialBet,
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
  voiceStatus,
  voiceSupported,
}) {
  return (
    <div className="game-controls" aria-label="Game controls">
      {gameState === 'betting' && (
        <div className="betting-controls">
          <label className="control-field" htmlFor="wager">
            <span>Wager per spot</span>
            <span className="control-input has-prefix">
              <b>$</b>
              <input id="wager" aria-label="Wager amount" type="number" value={initialBet} onChange={(e) => setInitialBet(Number(e.target.value))} step="25" min="25" />
            </span>
          </label>
          <label className="control-field" htmlFor="spots">
            <span>Player spots</span>
            <select id="spots" aria-label="Number of spots" value={numHands} onChange={(e) => setNumHands(Number(e.target.value))}>
              <option value={1}>1 spot</option>
              <option value={2}>2 spots</option>
            </select>
          </label>
          <button className="deal-button" onClick={onDeal}>
            <span>Deal cards</span>
            <small>${initialBet * numHands} total</small>
          </button>
        </div>
      )}

      {gameState === 'insurance' && (
        <div className="insurance-controls">
          <div className="decision-copy">
            <span className="decision-kicker">Dealer shows an Ace</span>
            <strong>Insure eligible hands?</strong>
            <small>Costs half your wager. Pays 2:1 only if the dealer has blackjack.</small>
          </div>
          <button className="decision-button is-gold" onClick={() => onInsurance(true)}>Buy insurance</button>
          <button className="decision-button" onClick={() => onInsurance(false)}>No insurance</button>
        </div>
      )}

      {gameState === 'playing' && (
        <div className="action-cluster">
          <button className="action-button is-hit" onClick={onHit}><span>Hit</span><small>Take a card</small></button>
          <button className="action-button is-stand" onClick={onStand}><span>Stand</span><small>Hold total</small></button>
          {canDouble && <button className="action-button is-double" onClick={onDouble}><span>Double</span><small>One card</small></button>}
          {canSplit && <button className="action-button is-split" onClick={onSplit}><span>{canResplit ? 'Resplit' : 'Split'}</span><small>Up to 4 hands</small></button>}
          <button
            className={`voice-action ${voiceInputEnabled ? 'is-on' : ''} ${voiceStatus === 'listening' ? 'is-listening' : ''}`}
            onClick={onToggleVoiceInput}
            disabled={!voiceSupported}
            aria-pressed={voiceInputEnabled}
          >
            <span className="mic-icon" aria-hidden="true">●</span>
            <span>
              {voiceSupported
                ? voiceStatus === 'blocked'
                  ? 'Microphone blocked'
                  : voiceStatus === 'listening'
                    ? 'Listening…'
                    : voiceInputEnabled ? 'Voice commands on' : 'Enable voice commands'
                : 'Voice commands unavailable'}
              <small>{lastHeard ? `Heard: “${lastHeard}”` : 'Say “hit” or “stand”'}</small>
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
