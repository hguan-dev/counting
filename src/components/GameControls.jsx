import NumberField from './NumberField';

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
  actionEvs = null,
  activeBet = 0,
}) {
  const evFor = action => (actionEvs?.evs?.[action] === undefined ? null : actionEvs.evs[action]);
  const bestEv = actionEvs?.best ? actionEvs.evs[actionEvs.best] : null;
  const money = value => `${value < 0 ? '−' : '+'}$${Math.abs(value * activeBet).toFixed(activeBet * Math.abs(value) < 10 ? 2 : 0)}`;
  const isBest = action => actionEvs?.best === action;
  const actionSub = (action) => {
    const value = evFor(action);
    const hinted = hintedAction === action;
    if (value === null && !hinted) return null;
    if (value === null) return <small className="action-sub">Recommended</small>;
    const gap = bestEv !== null && !isBest(action) ? bestEv - value : 0;
    return (
      <small className={`action-sub ${isBest(action) ? 'is-best' : ''}`}>
        {hinted ? 'Recommended · ' : ''}
        {activeBet > 0 ? money(value) : `${value >= 0 ? '+' : '−'}${Math.abs(value * 100).toFixed(1)}%`}
        {isBest(action) ? ' · best' : gap > 0.0005 ? ` · ${(gap * 100).toFixed(1)} pts worse` : ''}
      </small>
    );
  };
  const evCaption = () => {
    if (!actionEvs || bestEv === null) return null;
    const bestName = { double: 'Doubling', hit: 'Hitting', split: 'Splitting', stand: 'Standing', surrender: 'Surrendering' }[actionEvs.best] || actionEvs.best;
    if (bestEv < 0) {
      return `Every option loses on average here — ${bestName.toLowerCase()} loses least (${(bestEv * 100).toFixed(1)}% of your bet).`;
    }
    return `${bestName} is a favourite here: about ${(bestEv * 100).toFixed(1)}% of your bet on average.`;
  };
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
                <NumberField
                  id={`wager-${spotIndex + 1}`}
                  aria-label={`Spot ${spotIndex + 1} wager amount`}
                  value={spotBets[spotIndex]}
                  onCommit={amount => setSpotBet(spotIndex, amount)}
                  clamp={amount => Math.min(10000, Math.max(5, Math.round(amount * 2) / 2))}
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

      {gameState === 'playing' && actionEvs && (
        <div className="ev-caption" aria-live="polite">
          <div className="ev-caption-row">
            <span>Expected result per hand at this count{activeBet ? ` on your $${activeBet}` : ''}</span>
            <b>Dealer busts {Math.round(actionEvs.dealerBust * 100)}%</b>
          </div>
          <p>{evCaption()}</p>
        </div>
      )}

      {gameState === 'playing' && (
        <div className={`action-cluster ${actionEvs ? 'has-evs' : ''}`}>
          <button
            className={`action-button is-hit ${hintedAction === 'hit' ? 'is-hinted' : ''} ${isBest('hit') ? 'is-best-ev' : ''}`}
            onClick={onHit}
          >
            <span>Hit</span>
            {actionSub('hit')}
          </button>
          <button
            className={`action-button is-stand ${hintedAction === 'stand' ? 'is-hinted' : ''} ${isBest('stand') ? 'is-best-ev' : ''}`}
            onClick={onStand}
          >
            <span>Stand</span>
            {actionSub('stand')}
          </button>
          {canDouble && (
            <button
              className={`action-button is-double ${hintedAction === 'double' ? 'is-hinted' : ''} ${isBest('double') ? 'is-best-ev' : ''}`}
              onClick={onDouble}
            >
              <span>Double</span>
              {actionSub('double')}
            </button>
          )}
          {canSplit && (
            <button
              className={`action-button is-split ${hintedAction === 'split' ? 'is-hinted' : ''} ${isBest('split') ? 'is-best-ev' : ''}`}
              onClick={onSplit}
            >
              <span>{canResplit ? 'Resplit' : 'Split'}</span>
              {actionSub('split')}
            </button>
          )}
          {canSurrender && (
            <button
              className={`action-button is-surrender ${hintedAction === 'surrender' ? 'is-hinted' : ''} ${isBest('surrender') ? 'is-best-ev' : ''}`}
              onClick={onSurrender}
            >
              <span>Surrender</span>
              {actionSub('surrender')}
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
