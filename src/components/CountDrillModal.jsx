import { useState } from 'react';

export default function CountDrillModal({ actualCount, trueCount, decksRemaining, onResolve }) {
  const [guess, setGuess] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const numericGuess = Number(guess);
  const hasGuess = guess !== '' && Number.isFinite(numericGuess);
  const difference = hasGuess ? Math.abs(numericGuess - actualCount) : null;
  const formatCount = value => `${value > 0 ? '+' : ''}${value}`;

  const submit = (event) => {
    event.preventDefault();
    if (!hasGuess) return;
    setSubmitted(true);
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Shuffle count check">
      <div className="modal-card count-drill-card">
        <span className="modal-kicker">Shuffle · Count check</span>
        <h2>{submitted ? (difference === 0 ? 'Dead on.' : `Off by ${difference}`) : 'What is the running count?'}</h2>

        {!submitted ? (
          <form className="count-drill-form" onSubmit={submit}>
            <div className="count-drill-input">
              <button
                type="button"
                aria-label="Decrease guess"
                onClick={() => setGuess(String((hasGuess ? numericGuess : 0) - 1))}
              >
                −
              </button>
              <input
                autoFocus
                aria-label="Your running count guess"
                type="number"
                inputMode="numeric"
                step="1"
                value={guess}
                placeholder="0"
                onChange={event => setGuess(event.target.value)}
              />
              <button
                type="button"
                aria-label="Increase guess"
                onClick={() => setGuess(String((hasGuess ? numericGuess : 0) + 1))}
              >
                +
              </button>
            </div>
            <div className="modal-actions">
              <button type="submit" className="modal-primary" disabled={!hasGuess}>
                Check my count
              </button>
              <button type="button" className="modal-ghost" onClick={() => onResolve(null)}>
                Skip
              </button>
            </div>
          </form>
        ) : (
          <>
            <div className="count-drill-reveal">
              <div>
                <span>Your call</span>
                <strong>{formatCount(numericGuess)}</strong>
              </div>
              <div className={difference === 0 ? 'is-correct' : 'is-missed'}>
                <span>Actual running</span>
                <strong>{formatCount(actualCount)}</strong>
              </div>
              <div>
                <span>True count</span>
                <strong>{formatCount(trueCount)}</strong>
              </div>
              <div>
                <span>Decks left</span>
                <strong>{decksRemaining.toFixed(1)}</strong>
              </div>
            </div>
            <div className="modal-actions">
              <button
                className="modal-primary"
                autoFocus
                onClick={() => onResolve(numericGuess)}
              >
                Shuffle up &amp; deal
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
