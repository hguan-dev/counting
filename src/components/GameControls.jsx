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
  onSurrender,
  canDouble,
  canSplit,
  canSurrender,
  canResplit,
  hintedAction,
  onHint,
  onInsurance,
  onNextRound,
}) {
  return (
    <div className={`game-controls is-${gameState}`} aria-label="Game controls">
      {gameState === 'betting' && (
        <div className={`betting-controls has-${numHands}-spots`}>
          <fieldset className="control-field spot-selector">
            <legend>Player spots</legend>
            <div className="spot-options">
              {[1, 2].map(count => (
                <button
                  key={count}
                  type="button"
                  className={numHands === count ? 'is-selected' : ''}
                  aria-pressed={numHands === count}
                  onClick={() => setNumHands(count)}
                >
                  {count} {count === 1 ? 'spot' : 'spots'}
                </button>
              ))}
            </div>
          </fieldset>
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
                  step="25"
                  min="25"
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
          <button
            className={`action-button is-hit ${hintedAction === 'hit' ? 'is-hinted' : ''}`}
            onClick={onHit}
          >
            <span>Hit</span>
            {hintedAction === 'hit' && <small>Recommended</small>}
          </button>
          <button
            className={`action-button is-stand ${hintedAction === 'stand' ? 'is-hinted' : ''}`}
            onClick={onStand}
          >
            <span>Stand</span>
            {hintedAction === 'stand' && <small>Recommended</small>}
          </button>
          {canDouble && (
            <button
              className={`action-button is-double ${hintedAction === 'double' ? 'is-hinted' : ''}`}
              onClick={onDouble}
            >
              <span>Double</span>
              {hintedAction === 'double' && <small>Recommended</small>}
            </button>
          )}
          {canSplit && (
            <button
              className={`action-button is-split ${hintedAction === 'split' ? 'is-hinted' : ''}`}
              onClick={onSplit}
            >
              <span>{canResplit ? 'Resplit' : 'Split'}</span>
              {hintedAction === 'split' && <small>Recommended</small>}
            </button>
          )}
          {canSurrender && (
            <button
              className={`action-button is-surrender ${hintedAction === 'surrender' ? 'is-hinted' : ''}`}
              onClick={onSurrender}
            >
              <span>Surrender</span>
              {hintedAction === 'surrender' && <small>Recommended</small>}
            </button>
          )}
          <button
            className="action-button is-hint"
            onClick={onHint}
            aria-label="Show strategy hint"
            title="Show strategy hint"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M9 18h6M10 22h4M8.3 14.7A6 6 0 1 1 15.7 14.7C14.6 15.5 14 16.3 14 18h-4c0-1.7-.6-2.5-1.7-3.3Z" />
              <path d="M12 2V0M4.9 4.9 3.5 3.5M19.1 4.9l1.4-1.4M2 12H0M24 12h-2" />
            </svg>
            <span className="sr-only">Hint</span>
          </button>
        </div>
      )}

      {gameState === 'resolved' && (
        <div className="next-round-controls">
          <div className="queued-wager" aria-label="Queued wager for next round">
            <span>Next wager</span>
            <strong>
              {spotBets.slice(0, numHands).map((bet, index) => (
                <b key={index}>Spot {index + 1} · ${bet}</b>
              ))}
            </strong>
            <small>${spotBets.slice(0, numHands).reduce((sum, bet) => sum + bet, 0)} total</small>
          </div>
          <button className="next-round-button" onClick={onNextRound}>
            Deal next round
          </button>
        </div>
      )}

      {(gameState === 'dealerRevealing' || gameState === 'shuffling' || gameState === 'aiPlaying') && (
        <button className="next-round-button" disabled>
          {gameState === 'shuffling'
            ? 'Shuffling shoe…'
            : gameState === 'aiPlaying' ? 'Table in action…' : 'Dealer revealing…'}
        </button>
      )}
    </div>
  );
}
