import { useEffect, useRef, useState } from 'react';

const CHIP_COLORS = {
  2.5: '#e84393',
  5: '#c0392b',
  25: '#27ae60',
  100: '#1c1c1c',
  500: '#8e7cc3',
  1000: '#f39c12',
};

const DENOMINATIONS = [1000, 500, 100, 25, 5, 2.5];
const VISIBLE_PER_STACK = 8;

const formatChip = value => (
  value >= 1000 ? `${value / 1000}K` : value === 2.5 ? '2.5' : String(value)
);

// Break a bankroll into a realistic rack: the first $2,000 as playing chips
// (blacks, greens, reds, pinks), anything above as $500 / $1,000 checks.
const breakIntoStacks = (amount) => {
  const counts = {};
  let remaining = Math.max(0, Math.round(amount * 2) / 2);
  const highRoll = Math.max(0, remaining - 2000);
  let high = highRoll;
  [1000, 500].forEach((denomination) => {
    counts[denomination] = Math.floor(high / denomination);
    high -= counts[denomination] * denomination;
  });
  remaining -= highRoll - high;
  [100, 25, 5, 2.5].forEach((denomination) => {
    counts[denomination] = Math.floor(remaining / denomination + 1e-9);
    remaining -= counts[denomination] * denomination;
  });
  return DENOMINATIONS
    .filter(denomination => counts[denomination] > 0)
    .map(denomination => ({ count: counts[denomination], denomination }));
};

export default function ChipRack({ amount, canBet = false, onDropChip, onTapChip }) {
  const stacks = breakIntoStacks(amount);
  const [drag, setDrag] = useState(null);
  const dragRef = useRef(null);
  dragRef.current = drag;

  useEffect(() => {
    if (!drag) return undefined;
    document.body.classList.add('is-chip-dragging');
    const move = (event) => {
      setDrag(current => (current ? { ...current, x: event.clientX, y: event.clientY } : current));
    };
    const finish = (event) => {
      const current = dragRef.current;
      setDrag(null);
      document.body.classList.remove('is-chip-dragging');
      if (!current) return;
      const moved = Math.hypot(event.clientX - current.startX, event.clientY - current.startY);
      if (moved < 8) {
        onTapChip?.(current.denomination);
        return;
      }
      const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-bet-target]');
      if (target) onDropChip?.(current.denomination, Number(target.dataset.betTarget));
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', finish);
    return () => {
      document.body.classList.remove('is-chip-dragging');
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);
    };
  }, [drag ? drag.denomination : null, onDropChip, onTapChip]); // eslint-disable-line react-hooks/exhaustive-deps

  const beginDrag = (event, denomination) => {
    if (!canBet) return;
    event.preventDefault();
    setDrag({ denomination, startX: event.clientX, startY: event.clientY, x: event.clientX, y: event.clientY });
  };

  return (
    <>
      <div
        className={`chip-rack ${canBet ? 'is-live' : ''}`}
        role="group"
        aria-label={`Your chips: $${amount.toLocaleString()}${canBet ? '. Drag or tap a chip to add it to your bet.' : ''}`}
        title={`Your chips · $${amount.toLocaleString()}${canBet ? ' — drag a chip to your betting circle' : ''}`}
      >
        {stacks.length === 0 && <span className="chip-rack-empty">Felt</span>}
        {stacks.map(({ count, denomination }) => {
          const visible = Math.min(count, VISIBLE_PER_STACK);
          return (
            <button
              key={denomination}
              type="button"
              className="chip-stack"
              style={{ '--chip-color': CHIP_COLORS[denomination], '--stack-size': visible }}
              onPointerDown={event => beginDrag(event, denomination)}
              disabled={!canBet}
              aria-label={`${count} $${denomination} chip${count === 1 ? '' : 's'}${canBet ? ', add to bet' : ''}`}
            >
              <span className="chip-stack-tokens" aria-hidden="true">
                {Array.from({ length: visible }, (_, index) => (
                  <i key={index} style={{ '--i': index }}>
                    {index === visible - 1 ? formatChip(denomination) : ''}
                  </i>
                ))}
              </span>
              <small aria-hidden="true">×{count}</small>
            </button>
          );
        })}
      </div>
      {drag && (
        <div
          className="chip-ghost"
          style={{ '--chip-color': CHIP_COLORS[drag.denomination], left: drag.x, top: drag.y }}
          aria-hidden="true"
        >
          {formatChip(drag.denomination)}
        </div>
      )}
    </>
  );
}
