export default function GameControls({
  gameState,
  initialBet,
  setInitialBet,
  numHands,
  setNumHands,
  onDeal,
  onHit,
  onStand,
  onDouble,
  onSplit,
  canDouble,
  canSplit,
  onInsurance,
  onNextRound
}) {
  const inputStyle = { padding: '0.7rem', width: '100px', textAlign: 'center', borderRadius: '8px', background: 'rgba(0,0,0,0.6)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)' };
  const actionBtnStyle = { padding: '0.8rem 2.2rem', fontSize: '1.05rem', background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px', cursor: 'pointer' };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'rgba(0, 0, 0, 0.4)', padding: '1.2rem 2.5rem', borderRadius: '16px', gap: '1.5rem', minHeight: '80px' }}>
      {gameState === 'betting' && (
        <>
          <span>Wager:</span>
          <input type="number" value={initialBet} onChange={(e) => setInitialBet(Number(e.target.value))} step="25" min="25" style={inputStyle} />
          <span>Spots:</span>
          <select value={numHands} onChange={(e) => setNumHands(Number(e.target.value))} style={{ ...inputStyle, width: '70px' }}>
            <option value={1}>1</option>
            <option value={2}>2</option>
          </select>
          <button onClick={onDeal} style={{ ...actionBtnStyle, background: '#2ecc71', color: '#000', fontWeight: '600' }}>DEAL</button>
        </>
      )}

      {gameState === 'insurance' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <span style={{ color: '#f1c40f', fontWeight: '500' }}>Dealer shows an Ace. Take Insurance?</span>
          <button onClick={() => onInsurance(true)} style={{ ...actionBtnStyle, background: '#f1c40f', color: '#000', fontWeight: '600' }}>Yes (Pay 2:1)</button>
          <button onClick={() => onInsurance(false)} style={actionBtnStyle}>Decline</button>
        </div>
      )}

      {gameState === 'playing' && (
        <>
          <button onClick={onHit} style={actionBtnStyle}>Hit</button>
          <button onClick={onStand} style={actionBtnStyle}>Stand</button>
          {canDouble && <button onClick={onDouble} style={actionBtnStyle}>Double</button>}
          {canSplit && <button onClick={onSplit} style={actionBtnStyle}>Split</button>}
        </>
      )}

      {(gameState === 'resolved' || gameState === 'dealerRevealing' || gameState === 'shuffling') && gameState !== 'insurance' && gameState !== 'playing' && gameState !== 'betting' && (
        <button onClick={onNextRound} disabled={gameState === 'dealerRevealing' || gameState === 'shuffling'} style={{ ...actionBtnStyle, background: '#f1c40f', color: '#000', fontWeight: '600', opacity: gameState === 'dealerRevealing' ? 0.5 : 1 }}>
          {gameState === 'shuffling' ? 'SHUFFLING SHOE...' : gameState === 'dealerRevealing' ? 'DEALER REVEALING...' : 'DEAL NEXT ROUND'}
        </button>
      )}
    </div>
  );
}
