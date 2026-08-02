import { useState, useRef } from 'react';
import { Shoe } from './models/Shoe';
import { calculateTotal, getDetailedPlay } from './utils/strategyEngine';
import {
  canSplitHand,
  findNextPlayableHand,
  isNaturalBlackjack,
  splitHand,
} from './utils/handRules';
import { GameLogger } from './utils/logger';
import CheatSheet from './components/CheatSheet';
import PopupModal from './components/PopupModal';
import GameControls from './components/GameControls';

const getChipColor = (denom) => {
  if (denom >= 500) return '#a29bfe';
  if (denom >= 100) return '#111111';
  if (denom >= 25) return '#27ae60';
  if (denom >= 5) return '#c0392b';
  return '#e84393';
};

const isSoft17 = (cards) => {
  if (calculateTotal(cards) !== 17) return false;
  let hardSum = 0;
  let aces = 0;
  cards.forEach(c => {
    hardSum += (c.value === 'A' ? 1 : c.numericValue);
    if (c.value === 'A') aces++;
  });
  return hardSum === 7 && aces > 0;
};

export default function App() {
  const shoeRef = useRef(new Shoe(6));
  const loggerRef = useRef(new GameLogger());
  
  const [bankroll, setBankroll] = useState(1000);
  const [initialBet, setInitialBet] = useState(25);
  const [numHands, setNumHands] = useState(1);
  
  const [gameState, setGameState] = useState('betting'); 
  const [playerSpots, setPlayerSpots] = useState([]); 
  const [activeSpotIndex, setActiveSpotIndex] = useState(0);
  const [activeSubHandIndex, setActiveSubHandIndex] = useState(0);
  const [dealerHand, setDealerHand] = useState([]);
  const [showCount, setShowCount] = useState(false);
  const [showCheatSheet, setShowCheatSheet] = useState(false);
  const [insuranceBets, setInsuranceBets] = useState([]);
  const [evenMoneyOffered, setEvenMoneyOffered] = useState(false);
  
  const [warnStrategy, setWarnStrategy] = useState(true);
  const [showStrategyPopups, setShowStrategyPopups] = useState(true);
  const [pendingAction, setPendingAction] = useState(null);

  const deal = async () => {
    const totalWager = initialBet * numHands;
    if (bankroll < totalWager) return alert("Insufficient funds!");

    if (shoeRef.current.needsShuffle()) {
      setGameState('shuffling');
      loggerRef.current.log('SHUFFLE', 'Shoe penetration limit reached, reshuffling shoe.');
      await new Promise(r => setTimeout(r, 2000));
      shoeRef.current.buildAndShuffle();
    }

    setBankroll(b => b - totalWager);
    loggerRef.current.log('DEAL', `Wagered $${initialBet} across ${numHands} spot(s). Total: $${totalWager}`);
    setInsuranceBets(new Array(numHands).fill(0));
    setEvenMoneyOffered(false);
    
    const d1 = shoeRef.current.draw();
    shoeRef.current.visibleRunningCount += d1.countValue;

    const spots = [];
    for (let i = 0; i < numHands; i++) {
      const c1 = shoeRef.current.draw();
      const c2 = shoeRef.current.draw();
      shoeRef.current.visibleRunningCount += c1.countValue + c2.countValue;

      spots.push({
        subHands: [{
          cards: [c1, c2],
          bet: initialBet,
          status: 'playing',
          outcome: null,
          isSplitAce: false,
          isSplitHand: false
        }]
      });
    }
    const d2 = shoeRef.current.draw();
    setDealerHand([d1, d2]);

    const d1Val = d1.value;
    const isDealerTenOrFace = d1.numericValue === 10;
    const isDealerAce = d1Val === 'A';
    const dealerTotal = calculateTotal([d1, d2]);
    const dealerHasBJ = dealerTotal === 21;

    const hasPlayerBJ = spots.some(s => isNaturalBlackjack(s.subHands[0]));

    if (isDealerAce) {
      setPlayerSpots(spots);
      if (hasPlayerBJ) {
        setEvenMoneyOffered(true);
        setGameState('evenMoney');
        return;
      }
      setGameState('insurance');
      return;
    }

    if (isDealerTenOrFace && dealerHasBJ) {
      shoeRef.current.visibleRunningCount += d2.countValue;
      spots.forEach(s => s.subHands.forEach(h => h.outcome = 'loss'));
      setPlayerSpots(spots);
      setGameState('dealerRevealing');
      await new Promise(r => setTimeout(r, 800));

      let netReturn = 0;
      spots.forEach((spot) => {
        spot.subHands.forEach((hand) => {
          const isBJ = isNaturalBlackjack(hand);
          if (isBJ) {
            hand.outcome = 'push';
            netReturn += hand.bet;
          }
        });
      });

      setBankroll(b => b + netReturn);
      setGameState('resolved');
      return;
    }

    let payoutReturn = 0;
    spots.forEach((spot, sIdx) => {
      const h = spot.subHands[0];
      const isBJ = isNaturalBlackjack(h);

      if (isBJ) {
        h.outcome = 'win';
        payoutReturn += h.bet + (h.bet * 1.5);
        loggerRef.current.log('BLACKJACK', `Spot ${sIdx+1} natural Blackjack for +$${h.bet * 1.5}`);
        h.status = 'stood';
      }
    });

    setPlayerSpots(spots);
    setActiveSpotIndex(0);
    setActiveSubHandIndex(0);

    const allResolved = spots.every(spot => spot.subHands[0].status === 'stood');
    if (allResolved) {
      setBankroll(b => b + payoutReturn);
      setGameState('resolved');
    } else {
      findFirstActiveHand(spots, 0, 0, payoutReturn, totalWager);
    }
  };

  const findFirstActiveHand = (spots, sIdx, hIdx, runningReturn, totalWager) => {
    let found = false;
    for (let s = sIdx; s < spots.length; s++) {
      for (let h = (s === sIdx ? hIdx : 0); h < spots[s].subHands.length; h++) {
        if (spots[s].subHands[h].status === 'playing') {
          setActiveSpotIndex(s);
          setActiveSubHandIndex(h);
          setGameState('playing');
          found = true;
          return;
        }
      }
    }
    if (!found) playDealerAndResolve(dealerHand, spots, insuranceBets, runningReturn, totalWager);
  };

  const executeEvenMoney = async (accept) => {
    setEvenMoneyOffered(false);
    shoeRef.current.visibleRunningCount += dealerHand[1].countValue;
    setGameState('dealerRevealing');
    await new Promise(r => setTimeout(r, 800));

    const dealerHasBJ = calculateTotal(dealerHand) === 21;
    let totalReturn = 0;

    playerSpots.forEach((spot) => {
      spot.subHands.forEach((h) => {
        const isBJ = isNaturalBlackjack(h);
        if (isBJ) {
          if (accept) {
            h.outcome = 'win';
            totalReturn += h.bet * 2; 
          } else {
            if (dealerHasBJ) {
              h.outcome = 'push';
              totalReturn += h.bet;
            } else {
              h.outcome = 'win';
              totalReturn += h.bet + (h.bet * 1.5);
            }
          }
        }
      });
    });

    setBankroll(b => b + totalReturn);
    setGameState('resolved');
  };

  const executeInsurance = async (buy) => {
    let insTotalCost = buy ? (initialBet / 2) * numHands : 0;
    if (buy && bankroll < insTotalCost) return alert("Insufficient funds for insurance!");
    if (buy) setBankroll(b => b - insTotalCost);
    setInsuranceBets(playerSpots.map(() => buy ? initialBet / 2 : 0));

    const totalWager = initialBet * numHands + insTotalCost;
    const dealerHasBJ = calculateTotal(dealerHand) === 21;

    if (dealerHasBJ) {
      shoeRef.current.visibleRunningCount += dealerHand[1].countValue;
      setGameState('dealerRevealing');
      await new Promise(r => setTimeout(r, 800));

      let netReturn = buy ? insTotalCost * 3 : 0;
      playerSpots.forEach((spot) => {
        spot.subHands.forEach((hand) => {
          hand.outcome = 'loss';
          if (isNaturalBlackjack(hand)) {
            hand.outcome = 'push';
            netReturn += hand.bet;
          }
        });
      });
      setBankroll(b => b + netReturn);
      setGameState('resolved');
    } else {
      let spots = JSON.parse(JSON.stringify(playerSpots));
      let winnings = 0;
      spots.forEach((spot) => {
        spot.subHands.forEach(h => {
          if (isNaturalBlackjack(h)) {
            h.outcome = 'win';
            winnings += h.bet + (h.bet * 1.5);
            h.status = 'stood';
          }
        });
      });
      setPlayerSpots(spots);
      findFirstActiveHand(spots, 0, 0, winnings, totalWager);
    }
  };

  const getCurrentActiveHand = () => playerSpots[activeSpotIndex]?.subHands[activeSubHandIndex] || null;

  const executeHit = () => {
    let spots = JSON.parse(JSON.stringify(playerSpots));
    let hand = spots[activeSpotIndex].subHands[activeSubHandIndex];
    const drawnCard = shoeRef.current.draw();
    shoeRef.current.visibleRunningCount += drawnCard.countValue;
    hand.cards.push(drawnCard);
    const total = calculateTotal(hand.cards);
    
    if (total > 21) {
      hand.status = 'bust';
      hand.outcome = 'loss';
      advancePointer(spots);
    } else if (total === 21 || hand.isSplitAce) {
      hand.status = 'stood';
      advancePointer(spots);
    } else {
      setPlayerSpots(spots);
    }
  };

  const executeStand = () => {
    let spots = JSON.parse(JSON.stringify(playerSpots));
    spots[activeSpotIndex].subHands[activeSubHandIndex].status = 'stood';
    advancePointer(spots);
  };

  const executeDouble = () => {
    let spots = JSON.parse(JSON.stringify(playerSpots));
    let hand = spots[activeSpotIndex].subHands[activeSubHandIndex];
    if (bankroll < hand.bet) return alert("Insufficient funds to double!");
    
    setBankroll(b => b - hand.bet);
    hand.isDoubled = true;
    hand.bet *= 2;
    const drawnCard = shoeRef.current.draw();
    shoeRef.current.visibleRunningCount += drawnCard.countValue;
    hand.cards.push(drawnCard);
    const total = calculateTotal(hand.cards);
    
    if (total > 21) {
      hand.status = 'bust';
      hand.outcome = 'loss';
    } else {
      hand.status = 'stood';
    }
    advancePointer(spots);
  };

  const executeSplit = () => {
    let spots = JSON.parse(JSON.stringify(playerSpots));
    let spot = spots[activeSpotIndex];
    let hand = spot.subHands[activeSubHandIndex];
    if (bankroll < hand.bet) return alert("Insufficient funds to split!");

    setBankroll(b => b - hand.bet);
    const drawnCards = [];
    const splitHands = splitHand(hand, () => {
      const card = shoeRef.current.draw();
      drawnCards.push(card);
      return card;
    });
    shoeRef.current.visibleRunningCount += drawnCards.reduce((sum, card) => sum + card.countValue, 0);

    spot.subHands.splice(activeSubHandIndex, 1, ...splitHands);
    setPlayerSpots(spots);

    advancePointer(spots, true);
  };

  const advancePointer = (spots, includeCurrent = false) => {
    setPlayerSpots(spots);
    const next = findNextPlayableHand(
      spots,
      activeSpotIndex,
      activeSubHandIndex,
      includeCurrent,
    );

    if (next) {
      setActiveSpotIndex(next.spotIndex);
      setActiveSubHandIndex(next.handIndex);
      setGameState('playing');
      return;
    }

    const totalWager = playerSpots.reduce((acc, s) => acc + s.subHands.reduce((a, h) => a + (h.isDoubled ? h.bet / 2 : h.bet), 0), 0) + insuranceBets.reduce((a, b) => a + b, 0);
    playDealerAndResolve(dealerHand, spots, insuranceBets, 0, totalWager);
  };

  const playDealerAndResolve = async (dInitialHand, spots, insBets, presetWinnings, totalWager) => {
    setGameState('dealerRevealing');
    shoeRef.current.visibleRunningCount += dInitialHand[1].countValue;

    let dHand = [...dInitialHand];
    await new Promise(r => setTimeout(r, 1000));

    const dealerHasBlackjack = calculateTotal(dHand) === 21 && dHand.length === 2;
    const needsDealerDraw = spots.some(spot => spot.subHands.some(h => h.status === 'stood' && !isNaturalBlackjack(h)));

    if (needsDealerDraw && !dealerHasBlackjack) {
      while (calculateTotal(dHand) < 17 || isSoft17(dHand)) {
        await new Promise(r => setTimeout(r, 900)); 
        const drawnCard = shoeRef.current.draw();
        shoeRef.current.visibleRunningCount += drawnCard.countValue;
        dHand.push(drawnCard);
        setDealerHand([...dHand]);
      }
    }
    resolveRound(dHand, spots, insBets, presetWinnings, totalWager);
  };

  const resolveRound = (dHand, spots, insBets, presetWinnings) => {
    let totalReturn = presetWinnings;
    const dTotal = calculateTotal(dHand);
    const dBlackjack = dTotal === 21 && dHand.length === 2;

    insBets.forEach((insBet) => {
      if (dBlackjack && insBet > 0) totalReturn += insBet * 3;
    });

    spots.forEach((spot) => {
      spot.subHands.forEach((hand) => {
        const pTotal = calculateTotal(hand.cards);
        const isNaturalBJ = isNaturalBlackjack(hand);
        if (isNaturalBJ) {
          hand.outcome = 'win';
          return;
        }

        if (hand.status === 'bust') {
          hand.outcome = 'loss';
        } else {
          if (dBlackjack) {
            hand.outcome = 'loss';
          } else if (dTotal > 21 || pTotal > dTotal) {
            hand.outcome = 'win';
            totalReturn += hand.bet * 2; 
          } else if (pTotal < dTotal) {
            hand.outcome = 'loss';
          } else {
            hand.outcome = 'push';
            totalReturn += hand.bet;
          }
        }
      });
    });

    setBankroll(b => b + totalReturn);
    setGameState('resolved');
  };

  const handleAction = (actionType) => {
    const curHand = getCurrentActiveHand();
    if (!warnStrategy) {
      if (actionType === 'hit') return executeHit();
      if (actionType === 'stand') return executeStand();
      if (actionType === 'double') return executeDouble();
      if (actionType === 'split') return executeSplit();
    }

    const evaluation = getDetailedPlay(curHand.cards, dealerHand[0], shoeRef.current.trueCount);
    let optimal = evaluation.action;
    if (optimal === 'double' && curHand.cards.length > 2) optimal = calculateTotal(curHand.cards) >= 18 ? 'stand' : 'hit';
    
    if (actionType !== optimal) {
      if (!showStrategyPopups) {
        if (actionType === 'hit') executeHit();
        else if (actionType === 'stand') executeStand();
        else if (actionType === 'double') executeDouble();
        else if (actionType === 'split') executeSplit();
      } else {
        setPendingAction({ intended: actionType, optimal, type: 'play', category: evaluation.type, rule: evaluation.rule });
      }
    } else {
      if (actionType === 'hit') executeHit();
      if (actionType === 'stand') executeStand();
      if (actionType === 'double') executeDouble();
      if (actionType === 'split') executeSplit();
    }
  };

  const resolvePendingAction = (proceed) => {
    const action = pendingAction;
    setPendingAction(null);
    if (proceed) {
      if (action.intended === 'hit') executeHit();
      else if (action.intended === 'stand') executeStand();
      else if (action.intended === 'double') executeDouble();
      else if (action.intended === 'split') executeSplit();
    }
  };

  const canSplitCurrent = () => {
    return canSplitHand(getCurrentActiveHand());
  };

  const renderChipStack = (amount, outcome) => {
    let remaining = amount;
    const chips = [];
    [500, 100, 25, 5].forEach(d => {
      while (remaining >= d) { chips.push(d); remaining -= d; }
    });

    let glowClass = '';
    if (outcome === 'win') glowClass = 'chip-glow-green';
    else if (outcome === 'loss') glowClass = 'chip-glow-red';

    return (
      <div className={`chip-stack-container ${glowClass}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '8px', padding: '4px', borderRadius: '50px', transition: 'all 0.4s ease' }}>
        {chips.map((c, idx) => (
          <div key={idx} style={{
            width: '36px', height: '36px', borderRadius: '50%', background: getChipColor(c),
            border: '2px dashed #fff', boxShadow: '0 4px 8px rgba(0,0,0,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.7rem', fontWeight: 'bold', color: '#fff',
            transform: `translateY(-${idx * 6}px)`, zIndex: idx
          }}>${c}</div>
        ))}
        <div style={{ fontSize: '0.8rem', fontWeight: '600', color: '#f1c40f', marginTop: `-${(chips.length - 1) * 6}px` }}>${amount}</div>
      </div>
    );
  };

  const getCardColor = (suit) => (suit === '♥' || suit === '♦') ? '#e74c3c' : '#111';

  return (
    <main className="app-shell" style={{
      position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', 
      background: 'radial-gradient(circle at center, #0f4c20 0%, #072a12 70%, #031408 100%)', 
      color: '#fff', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', 
      display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '2rem 3rem', boxSizing: 'border-box',
      overflow: 'hidden', userSelect: 'none'
    }}>
      
      <style>{`
        @keyframes chipGreenGlow {
          0% { transform: scale(1); box-shadow: 0 0 10px #2ecc71; }
          50% { transform: scale(1.15); box-shadow: 0 0 30px #2ecc71, 0 0 50px #2ecc71; filter: brightness(1.3); }
          100% { transform: scale(1); box-shadow: 0 0 15px #2ecc71; }
        }
        @keyframes chipRedGlow {
          0% { transform: scale(1); box-shadow: 0 0 10px #e74c3c; }
          50% { transform: scale(1.05); box-shadow: 0 0 25px #e74c3c; }
          100% { transform: scale(1); box-shadow: 0 0 15px #e74c3c; }
        }
        @keyframes cardRevealSlow {
          0% { transform: rotateY(90deg) scale(0.9); opacity: 0; }
          100% { transform: rotateY(0deg) scale(1); opacity: 1; }
        }
        .card-reveal { animation: cardRevealSlow 0.7s cubic-bezier(0.25, 1, 0.5, 1) forwards; }
        .chip-glow-green { animation: chipGreenGlow 1.2s ease-in-out infinite; background: rgba(46, 204, 113, 0.2); }
        .chip-glow-red { animation: chipRedGlow 1.2s ease-in-out infinite; background: rgba(231, 76, 60, 0.2); }
      `}</style>

      {showCheatSheet && <CheatSheet onClose={() => setShowCheatSheet(false)} />}

      <PopupModal 
        isOpen={!!pendingAction}
        title="Sub-Optimal Play"
        category={pendingAction?.category}
        optimalAction={pendingAction?.optimal}
        rule={pendingAction?.rule}
        onCorrect={() => resolvePendingAction(false)}
        onProceed={() => resolvePendingAction(true)}
      />

      {/* HEADER BAR */}
      <div className="header-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1.2rem' }}>
        <div style={{ display: 'flex', gap: '3rem', alignItems: 'baseline' }}>
          <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: '400', color: '#f1c40f' }}>BLACKJACK</h1>
          <div style={{ display: 'flex', gap: '2rem', fontSize: '1.1rem' }}>
            <div><span style={{ opacity: 0.6 }}>Stack: </span><strong>${bankroll.toFixed(2)}</strong></div>
          </div>
        </div>
        <div className="header-actions" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <label style={{ fontSize: '0.9rem', cursor: 'pointer' }}>
            <input type="checkbox" checked={warnStrategy} onChange={() => setWarnStrategy(!warnStrategy)} style={{ accentColor: '#2ecc71' }} /> Guard
          </label>
          <label style={{ fontSize: '0.9rem', cursor: 'pointer' }}>
            <input type="checkbox" checked={showStrategyPopups} onChange={() => setShowStrategyPopups(!showStrategyPopups)} style={{ accentColor: '#3498db' }} /> Popups
          </label>
          <button onClick={() => setShowCheatSheet(true)} style={headerBtnStyle}>Study Guide</button>
          <button onClick={() => setShowCount(!showCount)} style={headerBtnStyle}>{showCount ? "Hide Count" : "Peek Count"}</button>
          <button onClick={() => loggerRef.current.downloadCSV()} style={{ ...headerBtnStyle, background: '#3498db', color: '#fff' }}>Export CSV</button>
        </div>
      </div>

      {showCount && (
        <div style={{ background: 'rgba(0,0,0,0.5)', padding: '0.8rem 2rem', borderRadius: '8px', display: 'flex', justifyContent: 'space-around', maxWidth: '500px', margin: '0 auto' }}>
          <span><strong>RC:</strong> {shoeRef.current.visibleRunningCount}</span>
          <span style={{ color: '#2ecc71' }}><strong>TC:</strong> {shoeRef.current.trueCount}</span>
        </div>
      )}

      {/* GAME BOARD TABLE */}
      <div className="game-board" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', flex: 1, gap: '3rem' }}>
        {gameState === 'shuffling' ? (
          <div style={{ color: '#f1c40f', fontSize: '2rem' }}>RESHUFFLING SHOE...</div>
        ) : (
          <>
            {/* DEALER AREA */}
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.85rem', opacity: 0.6, marginBottom: '0.8rem' }}>
                Dealer {gameState === 'playing' || gameState === 'insurance' || gameState === 'evenMoney' ? 'Showing' : dealerHand.length > 0 ? `(Total: ${calculateTotal(dealerHand)})` : ''}
              </div>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', minHeight: '110px' }}>
                {gameState === 'betting' ? (
                   <div style={{ width: '80px', height: '110px', border: '2px dashed rgba(255,255,255,0.15)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.3 }}>SHOE</div>
                ) : (
                  dealerHand.map((card, i) => {
                    const hidden = (gameState === 'playing' || gameState === 'insurance' || gameState === 'evenMoney') && i === 1;
                    return (
                      <div key={i} className="card-reveal" style={{ 
                        background: hidden ? 'repeating-linear-gradient(45deg, #111, #111 10px, #222 10px, #222 20px)' : '#fff', 
                        color: hidden ? 'transparent' : getCardColor(card.suit),
                        width: '80px', height: '110px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', borderRadius: '8px'
                      }}>{hidden ? '?' : `${card.value}${card.suit}`}</div>
                    );
                  })
                )}
              </div>
            </div>

            {/* PLAYER SPOTS */}
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.85rem', opacity: 0.6, marginBottom: '0.8rem' }}>Your Spots</div>
              <div className="player-spots" style={{ display: 'flex', gap: '3rem', justifyContent: 'center', minHeight: '130px' }}>
                {gameState === 'betting' ? (
                  <div style={{ border: '2px dashed rgba(255,255,255,0.15)', borderRadius: '10px', padding: '1.5rem 3rem', opacity: '0.3' }}>CONFIGURE WAGER BELOW</div>
                ) : (
                  playerSpots.map((spot, sIdx) => (
                    <div key={sIdx} style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start' }}>
                      {spot.subHands.map((hand, hIdx) => {
                        const isActive = sIdx === activeSpotIndex && hIdx === activeSubHandIndex && gameState === 'playing';
                        const isNaturalBJ = isNaturalBlackjack(hand);
                        return (
                          <div key={hIdx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                            <div style={{ 
                              border: isActive ? '2px solid #2ecc71' : '1px solid rgba(255,255,255,0.15)', 
                              padding: '1rem', borderRadius: '12px', background: isActive ? 'rgba(46, 204, 113, 0.08)' : 'rgba(0,0,0,0.25)',
                              minWidth: '160px'
                            }}>
                              <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
                                {hand.cards.map((card, cIdx) => (
                                  <div key={cIdx} className="card-reveal" style={{ 
                                    background: '#fff', color: getCardColor(card.suit), 
                                    width: '55px', height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px' 
                                  }}>{card.value}{card.suit}</div>
                                ))}
                              </div>
                              <div style={{ marginTop: '0.6rem', textAlign: 'right', fontSize: '0.9rem' }}>
                                {isNaturalBJ ? <span style={{ color: '#f1c40f' }}>BLACKJACK!</span> : `Total: ${calculateTotal(hand.cards)}`}
                              </div>
                            </div>
                            {renderChipStack(hand.bet, hand.outcome)}
                          </div>
                        );
                      })}
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* EVEN MONEY CONTROL OVERLAY OR CONTROLS */}
      {evenMoneyOffered ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'rgba(0, 0, 0, 0.4)', padding: '1.2rem 2.5rem', borderRadius: '16px', gap: '1.5rem' }}>
          <span style={{ color: '#f1c40f', fontWeight: '500' }}>You have a Blackjack! Dealer shows an Ace. Take Even Money (1:1)?</span>
          <button onClick={() => executeEvenMoney(true)} style={{ ...headerBtnStyle, background: '#f1c40f', color: '#000', fontWeight: '600' }}>Accept Even Money</button>
          <button onClick={() => executeEvenMoney(false)} style={headerBtnStyle}>Decline (Play Out)</button>
        </div>
      ) : (
        <GameControls
          gameState={gameState}
          initialBet={initialBet}
          setInitialBet={setInitialBet}
          numHands={numHands}
          setNumHands={setNumHands}
          onDeal={deal}
          onHit={() => handleAction('hit')}
          onStand={() => handleAction('stand')}
          onDouble={() => handleAction('double')}
          onSplit={() => handleAction('split')}
          canDouble={getCurrentActiveHand()?.cards.length === 2}
          canSplit={canSplitCurrent()}
          onInsurance={executeInsurance}
          onNextRound={() => setGameState('betting')}
        />
      )}
    </main>
  );
}

const headerBtnStyle = { padding: '0.5rem 1rem', background: 'rgba(255,255,255,0.08)', color: '#fff', border: '1px solid rgba(255,255,255,0.15)', cursor: 'pointer', borderRadius: '6px' };
