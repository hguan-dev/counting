export default function PopupModal({ isOpen, title, category, rule, optimalAction, onCorrect, onProceed }) {
  if (!isOpen) return null;

  const isViolation = category !== 'Outcome';

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 5000 }}>
      <div style={{ background: '#1c1c1e', padding: '2.5rem', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.15)', textAlign: 'center', maxWidth: '480px', boxShadow: '0 25px 50px rgba(0,0,0,0.8)', color: '#fff' }}>
        <div style={{ color: isViolation ? '#e74c3c' : '#f1c40f', fontSize: '0.85rem', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
          {category} {isViolation ? 'Violation' : ''}
        </div>
        <h2 style={{ marginTop: 0, fontWeight: '500', fontSize: '1.4rem' }}>{title || "Round Summary"}</h2>
        {optimalAction && (
          <p style={{ fontSize: '1.05rem', marginBottom: '1.5rem', lineHeight: '1.6', color: '#ccc' }}>
            The optimal move is <strong style={{ color: '#2ecc71' }}>{optimalAction.toUpperCase()}</strong>.
          </p>
        )}
        <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px', marginBottom: '2rem', fontSize: '0.95rem', lineHeight: '1.5', color: '#bbb', textAlign: 'left', borderLeft: `3px solid ${isViolation ? '#e74c3c' : '#f1c40f'}` }}>
          <strong>{isViolation ? 'The Rule:' : 'Result:'}</strong> {rule}
        </div>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
          {onCorrect && <button onClick={onCorrect} style={{ padding: '0.6rem 1.2rem', background: '#2ecc71', color: '#000', border: 'none', borderRadius: '6px', fontWeight: '600', cursor: 'pointer' }}>Correct Move</button>}
          {onProceed && <button onClick={onProceed} style={{ padding: '0.6rem 1.2rem', background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Play Anyway</button>}
        </div>
      </div>
    </div>
  );
}
