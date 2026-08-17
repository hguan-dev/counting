// A real shoe is never filled to the brim — leave headroom above the stack.
const STACK_MAX_PERCENT = 70;

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
          style={{ height: `${Math.max(1.5, remaining * STACK_MAX_PERCENT)}%` }}
        />
        <span
          className={`dealer-shoe-cut ${remaining <= cut ? 'is-reached' : ''}`}
          style={{ bottom: `calc(7px + ${cut * STACK_MAX_PERCENT}%)` }}
          aria-hidden="true"
        />
      </i>
      <span>Shoe</span>
    </div>
  );
}
