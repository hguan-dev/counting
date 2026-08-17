import { useLayoutEffect, useRef, useState } from 'react';
import { getCardAssetUrl } from '../utils/cardAssets';

const DEAL_DURATION_MS = 520;

export default function PlayingCard({
  card,
  hidden = false,
  compact = false,
  delay = 0,
  peel = false,
  animateDeal = true,
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const cardRef = useRef(null);
  const flipperRef = useRef(null);
  const assetUrl = getCardAssetUrl(card);
  const colorClass = card && (card.suit === '♥' || card.suit === '♦') ? 'is-red' : 'is-black';

  // Fly in from the dealer's shoe on mount, flipping face-up mid-flight when
  // the card is dealt face-up. Reveals (hidden → shown) later use the CSS flip.
  useLayoutEffect(() => {
    const element = cardRef.current;
    if (!element || !animateDeal || typeof element.animate !== 'function') return undefined;
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) return undefined;

    const shoe = document.querySelector('.dealer-shoe i');
    const target = element.getBoundingClientRect();
    let dx = 160;
    let dy = -140;
    if (shoe) {
      const origin = shoe.getBoundingClientRect();
      dx = origin.left + origin.width / 2 - (target.left + target.width / 2);
      dy = origin.top + origin.height / 2 - (target.top + target.height / 2);
    }

    const flight = element.animate(
      [
        { opacity: 0, transform: `translate(${dx}px, ${dy}px) rotate(-14deg) scale(0.72)`, offset: 0 },
        { opacity: 1, offset: 0.18 },
        { opacity: 1, transform: 'translate(0, 0) rotate(0deg) scale(1)', offset: 1 },
      ],
      { delay, duration: DEAL_DURATION_MS, easing: 'cubic-bezier(0.2, 0.85, 0.25, 1)', fill: 'backwards' },
    );

    let flip = null;
    if (!hidden && flipperRef.current) {
      flip = flipperRef.current.animate(
        [
          { transform: 'rotateY(180deg)', offset: 0 },
          { transform: 'rotateY(180deg)', offset: 0.42 },
          { transform: 'rotateY(0deg)', offset: 1 },
        ],
        { delay, duration: DEAL_DURATION_MS, easing: 'ease-out', fill: 'backwards' },
      );
    }
    return () => {
      flight.cancel();
      flip?.cancel();
    };
    // Mount-only: later prop changes must not re-deal the card.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={cardRef}
      className={`playing-card ${compact ? 'is-compact' : ''} ${hidden ? 'is-face-down' : ''} ${peel ? 'is-peeling' : ''}`}
      aria-label={hidden ? 'Face-down card' : `${card?.value || 'Unknown'} of ${card?.suit || 'unknown suit'}`}
    >
      <div className="card-flipper" ref={flipperRef}>
        <div className="card-face card-face-front">
          {assetUrl && !imageFailed ? (
            <img
              src={assetUrl}
              alt=""
              draggable="false"
              onError={() => setImageFailed(true)}
            />
          ) : (
            <div className={`card-fallback ${colorClass}`}>
              <span>{card?.value}</span>
              <span>{card?.suit}</span>
            </div>
          )}
        </div>
        <div className="card-face card-face-back">
          <span className="card-back-mark">♠</span>
        </div>
      </div>
    </div>
  );
}
