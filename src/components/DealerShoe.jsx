export default function DealerShoe({ remainingFraction, cutFraction, decksRemaining }) {
  const remaining = Math.min(1, Math.max(0, remainingFraction));
  const cut = Math.min(1, Math.max(0, cutFraction));

  return (
    <div
      className="dealer-shoe"
      role="img"
      aria-label={`Dealing shoe about ${Math.round(remaining * 100)} percent full`}
      title={`≈ ${decksRemaining.toFixed(1)} decks left in the shoe`}
    >
      <i>
        <span
          className="dealer-shoe-stack"
          style={{ height: `${Math.max(2, remaining * 100)}%` }}
        />
        <span
          className={`dealer-shoe-cut ${remaining <= cut ? 'is-reached' : ''}`}
          style={{ bottom: `${cut * 100}%` }}
          aria-hidden="true"
        />
      </i>
      <span>Shoe</span>
    </div>
  );
}
