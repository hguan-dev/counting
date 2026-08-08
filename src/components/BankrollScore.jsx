import { useEffect, useRef, useState } from 'react';

const formatMoney = (value) => {
  const rounded = Math.round(value * 100) / 100;
  return rounded.toLocaleString('en-US', {
    minimumFractionDigits: Number.isInteger(rounded) ? 0 : 2,
    maximumFractionDigits: 2,
  });
};

export default function BankrollScore({
  value,
  sessionPnl = null,
  accuracyRate = null,
  reloadOpen,
  onToggleReload,
}) {
  const [displayValue, setDisplayValue] = useState(value);
  const [delta, setDelta] = useState(null);
  const previousRef = useRef(value);
  const frameRef = useRef(null);
  const deltaTimerRef = useRef(null);

  useEffect(() => {
    const previous = previousRef.current;
    if (previous === value) return undefined;
    previousRef.current = value;

    setDelta({ amount: value - previous, key: Date.now() });
    window.clearTimeout(deltaTimerRef.current);
    deltaTimerRef.current = window.setTimeout(() => setDelta(null), 2200);

    const start = performance.now();
    const duration = 620;
    const animate = (now) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(previous + (value - previous) * eased);
      if (progress < 1) frameRef.current = requestAnimationFrame(animate);
    };
    cancelAnimationFrame(frameRef.current);
    frameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameRef.current);
  }, [value]);

  useEffect(() => () => {
    cancelAnimationFrame(frameRef.current);
    window.clearTimeout(deltaTimerRef.current);
  }, []);

  return (
    <div className="bankroll-score">
      <div className="bankroll-panel">
        <span className="bankroll-label">Bankroll</span>
        <div className="bankroll-row">
          <strong className="bankroll-amount" aria-label={`Bankroll $${formatMoney(value)}`}>
            <sup>$</sup>
            {formatMoney(displayValue)}
          </strong>
          <button
            className="bankroll-reload"
            onClick={onToggleReload}
            aria-expanded={reloadOpen}
            aria-label="Add funds to bankroll"
            title="Add funds"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </div>
        {(sessionPnl !== null || accuracyRate !== null) && (
          <span
            className="bankroll-stats"
            aria-label={`Session realized P and L ${sessionPnl ?? 0} dollars. Strategy accuracy ${accuracyRate ?? 0} percent.`}
          >
            {sessionPnl !== null && (
              <span>
                <em>P&amp;L</em>
                <b className={sessionPnl >= 0 ? 'is-positive' : 'is-negative'}>
                  {sessionPnl >= 0 ? '+' : '−'}${formatMoney(Math.abs(sessionPnl))}
                </b>
              </span>
            )}
            {accuracyRate !== null && (
              <span>
                <em>Accuracy</em>
                <b>{accuracyRate}%</b>
              </span>
            )}
          </span>
        )}
        {delta && (
          <span
            key={delta.key}
            className={`bankroll-delta ${delta.amount >= 0 ? 'is-gain' : 'is-loss'}`}
            aria-hidden="true"
          >
            {delta.amount >= 0 ? '+' : '−'}${formatMoney(Math.abs(delta.amount))}
          </span>
        )}
      </div>
    </div>
  );
}
