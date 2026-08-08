export default function PopupModal({
  isOpen,
  title,
  category,
  rule,
  optimalAction,
  revealHint = false,
  onBack,
  onCorrect,
  onHint,
  onProceed,
}) {
  if (!isOpen) return null;

  const isViolation = category !== 'Outcome';

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label={title || 'Round summary'}>
      <div className="modal-card">
        <span className={`modal-kicker ${isViolation ? 'is-alert' : ''}`}>
          {category} {isViolation ? 'check' : ''}
        </span>
        <h2>{title || 'Round Summary'}</h2>
        {optimalAction && revealHint && (
          <p className="modal-lead">
            The optimal move is <strong>{optimalAction.toUpperCase()}</strong>.
          </p>
        )}
        <div className={`modal-rule ${isViolation ? 'is-alert' : ''}`}>
          {revealHint ? (
            <>
              <strong>{isViolation ? 'The rule' : 'Result'}</strong>
              <span>{rule}</span>
            </>
          ) : (
            <>
              <strong>Strategy check</strong>
              <span>This choice differs from the current basic-strategy or count-index play.</span>
            </>
          )}
        </div>
        <div className="modal-actions">
          {!revealHint && onHint && (
            <button className="modal-primary" onClick={onHint} aria-label="Show strategy hint">
              <span aria-hidden="true">💡</span> Hint
            </button>
          )}
          {!revealHint && onBack && (
            <button className="modal-ghost" onClick={onBack}>Go back</button>
          )}
          {revealHint && onCorrect && (
            <button className="modal-primary" onClick={onCorrect}>Use recommendation</button>
          )}
          {onProceed && (
            <button className="modal-ghost" onClick={onProceed}>Play it anyway</button>
          )}
        </div>
      </div>
    </div>
  );
}
