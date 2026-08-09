export default function ShoeTray({ dealtFraction, decks }) {
  const clamped = Math.min(1, Math.max(0, dealtFraction));
  const percent = Math.round(clamped * 100);
  const decksDealt = clamped * decks;

  return (
    <div
      className="shoe-tray"
      role="img"
      aria-label={`Discard tray about ${percent} percent full`}
      title={`≈ ${decksDealt.toFixed(1)} of ${decks} decks dealt`}
    >
      <div className="shoe-tray-well">
        <div
          className="shoe-tray-fill"
          style={{ height: `${Math.max(3, percent)}%` }}
        />
      </div>
      <span className="shoe-tray-label">Discards</span>
    </div>
  );
}
