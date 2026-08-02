import { useState } from 'react';
import { getCardAssetUrl } from '../utils/cardAssets';

export default function PlayingCard({ card, hidden = false, compact = false, delay = 0 }) {
  const [imageFailed, setImageFailed] = useState(false);
  const assetUrl = getCardAssetUrl(card);
  const colorClass = card && (card.suit === '♥' || card.suit === '♦') ? 'is-red' : 'is-black';

  if (hidden) {
    return (
      <div
        className={`playing-card card-back ${compact ? 'is-compact' : ''}`}
        aria-label="Face-down card"
        style={{ '--card-delay': `${delay}ms` }}
      >
        <span className="card-back-mark">♠</span>
      </div>
    );
  }

  return (
    <div
      className={`playing-card ${compact ? 'is-compact' : ''}`}
      aria-label={`${card?.value || 'Unknown'} of ${card?.suit || 'unknown suit'}`}
      style={{ '--card-delay': `${delay}ms` }}
    >
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
  );
}
