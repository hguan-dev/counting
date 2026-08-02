export default function CheatSheet({ onClose }) {
  return (
    <div style={{
      position: 'fixed', right: 0, top: 0, width: '420px', height: '100vh', 
      background: 'rgba(15, 15, 15, 0.96)', backdropFilter: 'blur(12px)', borderLeft: '1px solid rgba(255,255,255,0.1)', 
      padding: '2rem', overflowY: 'auto', zIndex: 3000, boxShadow: '-15px 0 40px rgba(0,0,0,0.8)', color: '#e0e0e0',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
        <h3 style={{ margin: 0, color: '#f1c40f', letterSpacing: '1px' }}>BASIC STRATEGY GUIDE</h3>
        <button onClick={onClose} style={{ background: 'transparent', color: '#fff', border: 'none', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
      </div>

      <div style={{ marginBottom: '1.5rem' }}>
        <h4 style={{ color: '#2ecc71', fontSize: '0.95rem', marginBottom: '0.5rem' }}>Hard Totals</h4>
        <ul style={{ fontSize: '0.85rem', lineHeight: '1.6', paddingLeft: '1.2rem', opacity: 0.9 }}>
          <li><strong>17+:</strong> Always Stand</li>
          <li><strong>13–16:</strong> Stand vs. Dealer 2–6, otherwise Hit</li>
          <li><strong>12:</strong> Stand vs. Dealer 4–6, otherwise Hit</li>
          <li><strong>11:</strong> Always Double (else Hit if &gt;2 cards)</li>
          <li><strong>10:</strong> Double vs. Dealer 2–9 (else Hit)</li>
          <li><strong>9:</strong> Double vs. Dealer 3–6 (else Hit)</li>
          <li><strong>5–8:</strong> Always Hit</li>
        </ul>
      </div>

      <div style={{ marginBottom: '1.5rem' }}>
        <h4 style={{ color: '#3498db', fontSize: '0.95rem', marginBottom: '0.5rem' }}>Soft Totals</h4>
        <ul style={{ fontSize: '0.85rem', lineHeight: '1.6', paddingLeft: '1.2rem', opacity: 0.9 }}>
          <li><strong>19–20 (A,8 / A,9):</strong> Always Stand</li>
          <li><strong>18 (A,7):</strong> Double vs. 3–6, Stand vs. 2,7,8, Hit vs. 9,10,A</li>
          <li><strong>17 (A,6):</strong> Double vs. 3–6, otherwise Hit</li>
          <li><strong>15–16 (A,4 / A,5):</strong> Double vs. 4–6, otherwise Hit</li>
          <li><strong>13–14 (A,2 / A,3):</strong> Double vs. 5–6, otherwise Hit</li>
        </ul>
      </div>

      <div style={{ marginBottom: '1.5rem' }}>
        <h4 style={{ color: '#e74c3c', fontSize: '0.95rem', marginBottom: '0.5rem' }}>Pairs</h4>
        <ul style={{ fontSize: '0.85rem', lineHeight: '1.6', paddingLeft: '1.2rem', opacity: 0.9 }}>
          <li><strong>A,A & 8,8:</strong> Always Split</li>
          <li><strong>10,10:</strong> Never Split (Stand)</li>
          <li><strong>9,9:</strong> Split vs. 2–6, 8, 9 (Stand vs. 7, 10, A)</li>
          <li><strong>7,7 & 2,2 & 3,3:</strong> Split vs. Dealer 2–7</li>
          <li><strong>6,6:</strong> Split vs. Dealer 2–6</li>
          <li><strong>5,5:</strong> Double like hard 10</li>
          <li><strong>4,4:</strong> Split vs. 5–6</li>
        </ul>
      </div>

      <div>
        <h4 style={{ color: '#f1c40f', fontSize: '0.95rem', marginBottom: '0.5rem' }}>Illustrious 18 Deviations</h4>
        <p style={{ fontSize: '0.85rem', lineHeight: '1.6', opacity: 0.85 }}>
          • Insurance at True Count ≥ +3<br/>
          • 16 vs. 10 at True Count ≥ 0 (Stand)<br/>
          • 15 vs. 10 at True Count ≥ +4 (Stand)<br/>
          • 11 vs. Ace at True Count ≥ +1 (Double)<br/>
          • 10 vs. 10 at True Count ≥ +4 (Double)
        </p>
      </div>
    </div>
  );
}
