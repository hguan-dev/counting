import { useState, useRef } from 'react';
import { Shoe } from './models/Shoe';
import { calculateTotal, getDetailedPlay } from './utils/strategyEngine';
import {
  applyEvenMoneyDecision,
  canSplitHand,
  findNextPlayableHand,
  getEvenMoneyOffers,
  getInsuranceBets,
  getNaturalBlackjackSettlement,
  isNaturalBlackjack,
  splitHand,
} from './utils/handRules';
import { GameLogger } from './utils/logger';
import CheatSheet from './components/CheatSheet';
import PopupModal from './components/PopupModal';
import GameControls from './components/GameControls';
import PlayingCard from './components/PlayingCard';
import useTableVoice from './hooks/useTableVoice';
import {
  getDealerCardCall,
  getDealerFinishCall,
  getSpokenCard,
  getSpokenHandTotal,
} from './utils/tableSpeech';

const getChipColor = (denom) => {
  if (denom >= 1000) return '#f97316';
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
  const handleActionRef = useRef(null);
  const voiceCommandRef = useRef(null);
  
  const [bankroll, setBankroll] = useState(1000);
  const [spotBets, setSpotBets] = useState([25, 25]);
  const [numHands, setNumHands] = useState(1);
  const [showReload, setShowReload] = useState(false);
  const [reloadAmount, setReloadAmount] = useState(500);
  
  const [gameState, setGameState] = useState('betting'); 
  const [playerSpots, setPlayerSpots] = useState([]); 
  const [activeSpotIndex, setActiveSpotIndex] = useState(0);
  const [activeSubHandIndex, setActiveSubHandIndex] = useState(0);
  const [dealerHand, setDealerHand] = useState([]);
  const [showCount, setShowCount] = useState(false);
  const [showCheatSheet, setShowCheatSheet] = useState(false);
  const [insuranceBets, setInsuranceBets] = useState([]);
  const [evenMoneyQueue, setEvenMoneyQueue] = useState([]);
  
  const [warnStrategy, setWarnStrategy] = useState(true);
  const [showStrategyPopups, setShowStrategyPopups] = useState(true);
  const [pendingAction, setPendingAction] = useState(null);

  const {
    announce,
    availableVoices,
    kokoroVoices,
    lastAnnouncement,
    lastHeard,
    playSound,
    selectedVoiceName,
    setSoundEnabled,
    setSpeechEnabled,
    setSelectedVoiceName,
    soundEnabled,
    speechEnabled,
    toggleVoiceInput,
    voiceInputEnabled,
    voiceError,
    voiceModelProgress,
    voiceModelStatus,
    voiceStatus,
    voiceSupported,
  } = useTableVoice({
    isListeningAllowed: !['dealerRevealing', 'shuffling'].includes(gameState),
    onCommand: command => voiceCommandRef.current?.(command),
  });

  const announcePlayerTurn = (spots, spotIndex, handIndex, lead = '') => {
    const spot = spots[spotIndex];
    const hand = spot?.subHands[handIndex];
    if (!hand) return;
    const handName = spot.subHands.length > 1
      ? `Split hand ${handIndex + 1}`
      : `Player spot ${spotIndex + 1}`;
    const options = ['hit', 'stand'];
    if (hand.cards.length === 2) options.push('double');
    if (spot.subHands.length < 4 && canSplitHand(hand)) options.push('split');
    const prefix = lead ? `${lead} ` : '';
    announce(
      `${prefix}${handName} has ${getSpokenHandTotal(hand.cards)}. Say ${options.join(', or ')}.`,
      { listenAfter: true },
    );
  };

  const addToBankroll = (amountOverride) => {
    const amount = Number(amountOverride ?? reloadAmount);
    if (!Number.isFinite(amount) || amount <= 0) return;
    const safeAmount = Math.min(amount, 100000);
    setBankroll(current => current + safeAmount);
    setReloadAmount(safeAmount);
    setShowReload(false);
    playSound('chips');
    announce(`${safeAmount} dollars added. Bankroll is reloaded.`, { listenAfter: true });
    loggerRef.current.log('RELOAD', `Added $${safeAmount} to bankroll.`);
  };

  const updateSpotBet = (spotIndex, amount) => {
    const nextAmount = Number(amount);
    setSpotBets(current => current.map((bet, index) => (
      index === spotIndex ? nextAmount : bet
    )));
  };

  const updateSpotCount = (count) => {
    const safeCount = count === 2 ? 2 : 1;
    setNumHands(safeCount);
    setSpotBets(current => (
      safeCount === 2 && current.length < 2 ? [current[0] || 25, current[0] || 25] : current
    ));
  };

  const deal = async () => {
    const activeBets = spotBets.slice(0, numHands);
    const totalWager = activeBets.reduce((sum, bet) => sum + bet, 0);
    if (activeBets.some(bet => !Number.isFinite(bet) || bet < 5)) {
      announce('Each spot needs a wager of at least 5 dollars.', { listenAfter: true });
      return;
    }
    if (bankroll < totalWager) {
      announce(`Insufficient funds. The wagers total ${totalWager} dollars and the bankroll is ${bankroll} dollars.`, { listenAfter: true });
      return;
    }

    if (shoeRef.current.needsShuffle()) {
      setGameState('shuffling');
      loggerRef.current.log('SHUFFLE', 'Shoe penetration limit reached, reshuffling shoe.');
      await new Promise(r => setTimeout(r, 2000));
      shoeRef.current.buildAndShuffle();
    }

    setBankroll(b => b - totalWager);
    playSound('deal');
    loggerRef.current.log('DEAL', `Wagered ${activeBets.map((bet, index) => `spot ${index + 1}: $${bet}`).join(', ')}. Total: $${totalWager}`);
    setInsuranceBets(new Array(numHands).fill(0));
    setEvenMoneyQueue([]);
    
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
          bet: activeBets[i],
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

    const evenMoneyOffers = getEvenMoneyOffers(spots);

    if (isDealerAce) {
      setPlayerSpots(spots);
      if (evenMoneyOffers.length > 0) {
        setEvenMoneyQueue(evenMoneyOffers);
        setGameState('evenMoney');
        announce(
          `Dealer shows an ace. Spot ${evenMoneyOffers[0].spotIndex + 1} has blackjack. Say take even money, or play it out.`,
          { listenAfter: true },
        );
        return;
      }
      setGameState('insurance');
      announce('Dealer shows an ace. Say buy insurance, or no insurance.', { listenAfter: true });
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
      playSound(netReturn > 0 ? 'chips' : 'loss');
      announce(
        `Dealer has blackjack. ${getRoundOutcomeSummary(spots)}. Round complete. Say next round when ready.`,
        { listenAfter: true },
      );
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
      playSound('win');
      announce(`Dealer upcard ${getSpokenCard(d1)}. Player blackjack. Say next round when ready.`, { listenAfter: true });
    } else {
      findFirstActiveHand(
        spots,
        0,
        0,
        payoutReturn,
        totalWager,
        `Dealer upcard ${getSpokenCard(d1)}.`,
      );
    }
  };

  const findFirstActiveHand = (spots, sIdx, hIdx, runningReturn, totalWager, lead = '') => {
    let found = false;
    for (let s = sIdx; s < spots.length; s++) {
      for (let h = (s === sIdx ? hIdx : 0); h < spots[s].subHands.length; h++) {
        if (spots[s].subHands[h].status === 'playing') {
          setActiveSpotIndex(s);
          setActiveSubHandIndex(h);
          setGameState('playing');
          if (runningReturn > 0) setBankroll(b => b + runningReturn);
          announcePlayerTurn(spots, s, h, lead);
          found = true;
          return;
        }
      }
    }
    if (!found) playDealerAndResolve(dealerHand, spots, insuranceBets, runningReturn, totalWager);
  };

  const executeEvenMoney = async (accept) => {
    const [currentOffer, ...remainingOffers] = evenMoneyQueue;
    if (!currentOffer) return;

    const spots = applyEvenMoneyDecision(playerSpots, currentOffer, accept);
    setPlayerSpots(spots);
    setEvenMoneyQueue(remainingOffers);
    loggerRef.current.log(
      'EVEN_MONEY',
      `Spot ${currentOffer.spotIndex + 1} ${accept ? 'accepted' : 'declined'} even money.`,
    );

    if (remainingOffers.length > 0) {
      announce(
        `Spot ${remainingOffers[0].spotIndex + 1} has blackjack. Say take even money, or play it out.`,
        { listenAfter: true },
      );
      return;
    }

    const hasInsuranceEligibleHand = spots.some(spot => (
      spot.subHands.some(hand => !isNaturalBlackjack(hand))
    ));
    if (hasInsuranceEligibleHand) {
      setGameState('insurance');
      announce('Even money decisions complete. Say buy insurance, or no insurance.', { listenAfter: true });
      return;
    }

    await executeInsurance(false, spots);
  };

  const executeInsurance = async (buy, spotsOverride = playerSpots) => {
    const nextInsuranceBets = getInsuranceBets(spotsOverride, buy);
    const insTotalCost = nextInsuranceBets.reduce((sum, bet) => sum + bet, 0);
    if (buy && bankroll < insTotalCost) {
      announce(`Insufficient funds for ${insTotalCost} dollars of insurance.`, { listenAfter: true });
      return;
    }
    if (buy) setBankroll(b => b - insTotalCost);
    setInsuranceBets(nextInsuranceBets);

    const totalWager = spotsOverride.reduce(
      (sum, spot) => sum + (spot.subHands[0]?.bet || 0),
      insTotalCost,
    );
    const dealerHasBJ = calculateTotal(dealerHand) === 21;

    if (dealerHasBJ) {
      shoeRef.current.visibleRunningCount += dealerHand[1].countValue;
      setGameState('dealerRevealing');
      await new Promise(r => setTimeout(r, 800));

      let netReturn = buy ? insTotalCost * 3 : 0;
      const spots = spotsOverride.map(spot => ({
        ...spot,
        subHands: spot.subHands.map(hand => ({ ...hand })),
      }));
      spots.forEach((spot) => {
        spot.subHands.forEach((hand) => {
          hand.outcome = 'loss';
          const settlement = getNaturalBlackjackSettlement(hand, true);
          if (settlement) {
            hand.outcome = settlement.outcome;
            hand.status = 'stood';
            netReturn += settlement.returnAmount;
          }
        });
      });
      setPlayerSpots(spots);
      setBankroll(b => b + netReturn);
      setGameState('resolved');
      playSound(netReturn > 0 ? 'chips' : 'loss');
      announce(
        `Dealer has blackjack. ${getRoundOutcomeSummary(spots)}. Round complete. Say next round when ready.`,
        { listenAfter: true },
      );
    } else {
      const spots = JSON.parse(JSON.stringify(spotsOverride));
      let winnings = 0;
      spots.forEach((spot) => {
        spot.subHands.forEach(h => {
          const settlement = getNaturalBlackjackSettlement(h, false);
          if (settlement) {
            h.outcome = settlement.outcome;
            winnings += settlement.returnAmount;
            h.status = 'stood';
          }
        });
      });
      setPlayerSpots(spots);
      const next = findNextPlayableHand(spots, 0, 0, true);
      if (next) {
        if (winnings > 0) setBankroll(b => b + winnings);
        setActiveSpotIndex(next.spotIndex);
        setActiveSubHandIndex(next.handIndex);
        setGameState('playing');
        announcePlayerTurn(
          spots,
          next.spotIndex,
          next.handIndex,
          'Dealer does not have blackjack.',
        );
      } else {
        playDealerAndResolve(dealerHand, spots, nextInsuranceBets, winnings, totalWager);
      }
    }
  };

  const getCurrentActiveHand = () => playerSpots[activeSpotIndex]?.subHands[activeSubHandIndex] || null;

  const executeHit = () => {
    let spots = JSON.parse(JSON.stringify(playerSpots));
    let hand = spots[activeSpotIndex].subHands[activeSubHandIndex];
    const drawnCard = shoeRef.current.draw();
    playSound('card');
    shoeRef.current.visibleRunningCount += drawnCard.countValue;
    hand.cards.push(drawnCard);
    const total = calculateTotal(hand.cards);
    
    if (total > 21) {
      hand.status = 'bust';
      hand.outcome = 'loss';
      advancePointer(spots, false, `Player draws ${getSpokenCard(drawnCard)} and busts with ${total}.`);
    } else if (total === 21 || hand.isSplitAce) {
      hand.status = 'stood';
      advancePointer(spots, false, `Player draws ${getSpokenCard(drawnCard)} and has ${total}.`);
    } else {
      setPlayerSpots(spots);
      announce(
        `Player draws ${getSpokenCard(drawnCard)}. Total ${getSpokenHandTotal(hand.cards)}. Hit or stand?`,
        { listenAfter: true },
      );
    }
  };

  const executeStand = () => {
    let spots = JSON.parse(JSON.stringify(playerSpots));
    const hand = spots[activeSpotIndex].subHands[activeSubHandIndex];
    hand.status = 'stood';
    playSound('stand');
    advancePointer(spots, false, `Player stands on ${getSpokenHandTotal(hand.cards)}.`);
  };

  const executeDouble = () => {
    let spots = JSON.parse(JSON.stringify(playerSpots));
    let hand = spots[activeSpotIndex].subHands[activeSubHandIndex];
    if (bankroll < hand.bet) {
      announce(`Insufficient funds to double. The hand needs ${hand.bet} more dollars.`, { listenAfter: true });
      return;
    }
    
    setBankroll(b => b - hand.bet);
    hand.isDoubled = true;
    hand.bet *= 2;
    const drawnCard = shoeRef.current.draw();
    playSound('card');
    shoeRef.current.visibleRunningCount += drawnCard.countValue;
    hand.cards.push(drawnCard);
    const total = calculateTotal(hand.cards);
    
    if (total > 21) {
      hand.status = 'bust';
      hand.outcome = 'loss';
    } else {
      hand.status = 'stood';
    }
    advancePointer(
      spots,
      false,
      `Player doubles and draws ${getSpokenCard(drawnCard)} for ${total}.`,
    );
  };

  const executeSplit = () => {
    let spots = JSON.parse(JSON.stringify(playerSpots));
    let spot = spots[activeSpotIndex];
    let hand = spot.subHands[activeSubHandIndex];
    if (spot.subHands.length >= 4 || !canSplitHand(hand)) return;
    if (bankroll < hand.bet) {
      announce(`Insufficient funds to split. The hand needs ${hand.bet} more dollars.`, { listenAfter: true });
      return;
    }

    setBankroll(b => b - hand.bet);
    const drawnCards = [];
    const splitHands = splitHand(hand, () => {
      const card = shoeRef.current.draw();
      drawnCards.push(card);
      return card;
    });
    shoeRef.current.visibleRunningCount += drawnCards.reduce((sum, card) => sum + card.countValue, 0);
    playSound('deal');

    spot.subHands.splice(activeSubHandIndex, 1, ...splitHands);
    setPlayerSpots(spots);

    advancePointer(
      spots,
      true,
      `Cards split. First hand draws ${getSpokenCard(drawnCards[0])}. Second hand draws ${getSpokenCard(drawnCards[1])}.`,
    );
  };

  const advancePointer = (spots, includeCurrent = false, lead = '') => {
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
      announcePlayerTurn(spots, next.spotIndex, next.handIndex, lead);
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
    await announce(getDealerCardCall(dHand[1]));

    const dealerHasBlackjack = calculateTotal(dHand) === 21 && dHand.length === 2;
    const needsDealerDraw = spots.some(spot => spot.subHands.some(h => h.status === 'stood' && !isNaturalBlackjack(h)));

    if (needsDealerDraw && !dealerHasBlackjack) {
      while (calculateTotal(dHand) < 17 || isSoft17(dHand)) {
        await new Promise(r => setTimeout(r, 900)); 
        const drawnCard = shoeRef.current.draw();
        playSound('card');
        shoeRef.current.visibleRunningCount += drawnCard.countValue;
        dHand.push(drawnCard);
        setDealerHand([...dHand]);
        await announce(getDealerCardCall(drawnCard));
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
    const outcomes = spots.flatMap(spot => spot.subHands.map(hand => hand.outcome));
    playSound(outcomes.includes('win') ? 'win' : outcomes.every(outcome => outcome === 'loss') ? 'loss' : 'chips');
    const outcomeSummary = spots.flatMap((spot, spotIndex) => (
      spot.subHands.map((hand, handIndex) => {
        const handName = spot.subHands.length > 1
          ? `spot ${spotIndex + 1}, split hand ${handIndex + 1}`
          : `spot ${spotIndex + 1}`;
        return `${handName} ${hand.outcome}`;
      })
    )).join('. ');
    announce(
      `${getDealerFinishCall(dHand)} ${outcomeSummary}. Round complete. Say next round when ready.`,
      { listenAfter: true },
    );
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
        announce(
          `${actionType} is not the recommended play. Basic strategy says ${optimal}. Say proceed to use ${actionType}, or say correct play to go back.`,
          { listenAfter: true },
        );
      }
    } else {
      if (actionType === 'hit') executeHit();
      if (actionType === 'stand') executeStand();
      if (actionType === 'double') executeDouble();
      if (actionType === 'split') executeSplit();
    }
  };

  handleActionRef.current = handleAction;

  const resolvePendingAction = (proceed) => {
    const action = pendingAction;
    setPendingAction(null);
    if (proceed) {
      if (action.intended === 'hit') executeHit();
      else if (action.intended === 'stand') executeStand();
      else if (action.intended === 'double') executeDouble();
      else if (action.intended === 'split') executeSplit();
    } else {
      announcePlayerTurn(
        playerSpots,
        activeSpotIndex,
        activeSubHandIndex,
        `Choose the recommended ${action.optimal}.`,
      );
    }
  };

  const canSplitCurrent = () => {
    const currentSpot = playerSpots[activeSpotIndex];
    return currentSpot?.subHands.length < 4 && canSplitHand(getCurrentActiveHand());
  };

  const getRoundOutcomeSummary = (spotsForSummary = playerSpots) => (
    spotsForSummary.flatMap((spot, spotIndex) => (
      spot.subHands.map((hand, handIndex) => {
        const handName = spot.subHands.length > 1
          ? `spot ${spotIndex + 1}, split hand ${handIndex + 1}`
          : `spot ${spotIndex + 1}`;
        return `${handName} ${hand.outcome || 'is unresolved'}`;
      })
    )).join('. ')
  );

  const getVoicePrompt = () => {
    if (pendingAction) {
      return `${pendingAction.intended} differs from basic strategy ${pendingAction.optimal}. Say proceed, or correct play.`;
    }

    if (gameState === 'betting') {
      const wagers = spotBets
        .slice(0, numHands)
        .map((bet, index) => `spot ${index + 1}, ${bet} dollars`)
        .join('; ');
      return `Betting is open with ${numHands} ${numHands === 1 ? 'spot' : 'spots'}: ${wagers}. Say one spot bet 25, or two spots bet 25 and 50. Then say deal.`;
    }

    if (gameState === 'evenMoney') {
      const offer = evenMoneyQueue[0];
      return `Spot ${offer?.spotIndex + 1} has blackjack. Say take even money, or play it out.`;
    }

    if (gameState === 'insurance') {
      return 'Dealer shows an ace. Say buy insurance, or no insurance.';
    }

    if (gameState === 'playing') {
      const hand = getCurrentActiveHand();
      const options = ['hit', 'stand'];
      if (hand?.cards.length === 2) options.push('double');
      if (canSplitCurrent()) options.push('split');
      return `Active spot ${activeSpotIndex + 1}${playerSpots[activeSpotIndex]?.subHands.length > 1 ? `, split hand ${activeSubHandIndex + 1}` : ''}, total ${getSpokenHandTotal(hand?.cards)}. Available actions are ${options.join(', ')}.`;
    }

    if (gameState === 'resolved') {
      return `${getRoundOutcomeSummary()}. Bankroll ${bankroll} dollars. Say next round when ready.`;
    }

    return gameState === 'shuffling'
      ? 'The shoe is shuffling. Please wait.'
      : 'The dealer is completing the round. Please wait.';
  };

  const configureVoiceBets = (command) => {
    const spotCount = command.spotCount || (command.bets.length > 1 ? command.bets.length : numHands);
    if (![1, 2].includes(spotCount)) {
      announce('This table supports one or two player spots.', { listenAfter: true });
      return;
    }

    const bets = command.bets.length === 1 && spotCount === 2
      ? [command.bets[0], command.bets[0]]
      : command.bets;
    if (
      bets.length !== spotCount
      || bets.some(bet => !Number.isFinite(bet) || bet < 5 || bet > 10000)
    ) {
      announce(
        `Please give one wager for each spot, between 5 and 10000 dollars. For example, say ${spotCount === 2 ? 'two spots bet 25 and 50' : 'one spot bet 25'}.`,
        { listenAfter: true },
      );
      return;
    }

    updateSpotCount(spotCount);
    setSpotBets(current => current.map((bet, index) => bets[index] ?? bet));
    const summary = bets.map((bet, index) => `spot ${index + 1}, ${bet} dollars`).join('; ');
    announce(`${spotCount} ${spotCount === 1 ? 'spot' : 'spots'} set. ${summary}. Say deal when ready.`, { listenAfter: true });
  };

  const beginNextRound = () => {
    setGameState('betting');
    announce('Betting is open. Change the spots and wagers, or say deal to repeat them.', { listenAfter: true });
  };

  const handleVoiceCommand = (command) => {
    if (command?.type === 'unknown' || !command) {
      announce(`I did not recognize that command. ${getVoicePrompt()}`, { listenAfter: true });
      return;
    }

    if (command.type === 'help') {
      announce(
        'You can set one or two spots with separate wagers, deal, hit, stand, double, split, buy or decline insurance, take or decline even money, start the next round, reload funds, ask for the count, bankroll, or status.',
        { listenAfter: true },
      );
      return;
    }
    if (command.type === 'status') {
      announce(getVoicePrompt(), { listenAfter: true });
      return;
    }
    if (command.type === 'micTest') {
      announce(
        `Microphone check passed. I heard ${lastHeard || 'your voice'} clearly.`,
        { listenAfter: true },
      );
      return;
    }
    if (command.type === 'bankroll') {
      announce(`Bankroll is ${bankroll} dollars. ${getVoicePrompt()}`, { listenAfter: true });
      return;
    }
    if (command.type === 'count') {
      setShowCount(true);
      announce(
        `Running count ${shoeRef.current.visibleRunningCount}. True count ${shoeRef.current.trueCount}.`,
        { listenAfter: true },
      );
      return;
    }
    if (command.type === 'sound') {
      setSoundEnabled(command.enabled);
      announce(`Sound effects ${command.enabled ? 'on' : 'off'}.`, { listenAfter: true });
      return;
    }
    if (command.type === 'speech') {
      announce(`Dealer voice ${command.enabled ? 'on' : 'off'}.`, { listenAfter: true });
      setSpeechEnabled(command.enabled);
      return;
    }
    if (command.type === 'guard') {
      setWarnStrategy(command.enabled);
      announce(`Strategy guard ${command.enabled ? 'on' : 'off'}.`, { listenAfter: true });
      return;
    }
    if (command.type === 'popups') {
      setShowStrategyPopups(command.enabled);
      announce(`Strategy popups ${command.enabled ? 'on' : 'off'}.`, { listenAfter: true });
      return;
    }
    if (command.type === 'studyGuide') {
      setShowCheatSheet(command.open);
      announce(`Study guide ${command.open ? 'opened' : 'closed'}.`, { listenAfter: true });
      return;
    }
    if (command.type === 'export') {
      loggerRef.current.downloadCSV();
      announce('Game log exported.', { listenAfter: true });
      return;
    }
    if (command.type === 'reload') {
      addToBankroll(command.amount);
      return;
    }

    if (pendingAction) {
      if (command.type === 'proceed') resolvePendingAction(true);
      else if (command.type === 'cancel') resolvePendingAction(false);
      else announce(getVoicePrompt(), { listenAfter: true });
      return;
    }

    if (gameState === 'betting') {
      if (command.type === 'configureBets') configureVoiceBets(command);
      else if (command.type === 'setSpots') {
        updateSpotCount(command.spotCount);
        announce(
          `${command.spotCount} ${command.spotCount === 1 ? 'spot' : 'spots'} selected. Say ${command.spotCount === 2 ? 'bet 25 and 50' : 'bet 25'}, or say deal to keep the current wager.`,
          { listenAfter: true },
        );
      } else if (command.type === 'deal') deal();
      else announce(getVoicePrompt(), { listenAfter: true });
      return;
    }

    if (gameState === 'playing') {
      if (command.type !== 'action') {
        announce(getVoicePrompt(), { listenAfter: true });
        return;
      }
      if (command.action === 'double' && getCurrentActiveHand()?.cards.length !== 2) {
        announce('Double is not available after a hit. Say hit or stand.', { listenAfter: true });
      } else if (command.action === 'split' && !canSplitCurrent()) {
        announce('Split is not available for this hand. Say hit or stand.', { listenAfter: true });
      } else {
        handleAction(command.action);
      }
      return;
    }

    if (gameState === 'insurance' && command.type === 'insurance') {
      executeInsurance(command.buy);
      return;
    }
    if (gameState === 'evenMoney' && command.type === 'evenMoney') {
      executeEvenMoney(command.accept);
      return;
    }
    if (gameState === 'resolved' && command.type === 'nextRound') {
      beginNextRound();
      return;
    }

    announce(getVoicePrompt(), { listenAfter: true });
  };

  voiceCommandRef.current = handleVoiceCommand;

  const handleVoiceToggle = () => {
    const enabling = !voiceInputEnabled;
    toggleVoiceInput();
    if (enabling) {
      playSound('chips');
      announce(
        `Hands free mode on. Say help at any time. ${getVoicePrompt()}`,
        { listenAfter: true },
      );
    }
  };

  const renderChipStack = (amount, outcome) => {
    let remaining = amount;
    const chips = [];
    [1000, 500, 100, 25, 5].forEach(d => {
      while (remaining >= d) { chips.push(d); remaining -= d; }
    });

    let glowClass = '';
    if (outcome === 'win') glowClass = 'chip-glow-green';
    else if (outcome === 'loss') glowClass = 'chip-glow-red';

    return (
      <div className={`chip-stack-container ${glowClass}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '8px', padding: '4px', borderRadius: '50px', transition: 'all 0.4s ease' }}>
        {chips.map((c, idx) => (
          <div className="chip-token" key={idx} style={{
            width: '36px', height: '36px', borderRadius: '50%', background: getChipColor(c),
            border: '2px dashed #fff', boxShadow: '0 4px 8px rgba(0,0,0,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.7rem', fontWeight: 'bold', color: '#fff',
            transform: `translateY(-${idx * 13}px)`, zIndex: idx,
            animationDelay: `${idx * 35}ms`,
          }}>${c >= 1000 ? `${c / 1000}K` : c}</div>
        ))}
        <div style={{ fontSize: '0.8rem', fontWeight: '600', color: '#f1c40f', marginTop: `-${Math.max(0, chips.length - 1) * 13}px` }}>${amount}</div>
      </div>
    );
  };

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
          0% { transform: translateY(12px) scale(0.92); opacity: 0.35; }
          52% { transform: translateY(-7px) scale(1.08); box-shadow: 0 0 28px rgba(46, 204, 113, 0.7); }
          76% { transform: translateY(2px) scale(0.99); }
          100% { transform: translateY(0) scale(1); box-shadow: 0 0 12px rgba(46, 204, 113, 0.32); opacity: 1; }
        }
        @keyframes chipRedGlow {
          0% { transform: translateX(0) rotate(0); opacity: 1; }
          35% { transform: translateX(-5px) rotate(-3deg); box-shadow: 0 0 20px rgba(231, 76, 60, 0.55); }
          100% { transform: translateX(20px) rotate(5deg); opacity: 0.46; }
        }
        @keyframes cardRevealSlow {
          0% { transform: rotateY(90deg) scale(0.9); opacity: 0; }
          100% { transform: rotateY(0deg) scale(1); opacity: 1; }
        }
        .card-reveal { animation: cardRevealSlow 0.7s cubic-bezier(0.25, 1, 0.5, 1) forwards; }
        .chip-glow-green { animation: chipGreenGlow 760ms cubic-bezier(0.2, 0.85, 0.3, 1) both; background: rgba(46, 204, 113, 0.12); }
        .chip-glow-red { animation: chipRedGlow 680ms ease-in both; background: rgba(231, 76, 60, 0.12); }
        .chip-token { animation: chipSettle 420ms cubic-bezier(0.22, 1, 0.36, 1) both; }
        @keyframes chipSettle {
          from { margin-top: -18px; opacity: 0; filter: brightness(1.35); }
          to { margin-top: 0; opacity: 1; filter: brightness(1); }
        }
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

      <div className="sr-only" aria-live="assertive" aria-atomic="true">{lastAnnouncement}</div>

      {/* HEADER BAR */}
      <div className="header-bar">
        <div className="brand-lockup">
          <span className="eyebrow">Count lab</span>
          <div className="brand-line">
            <h1>BLACKJACK</h1>
            <span className="table-rules">6 Decks · H17 · Blackjack 3:2</span>
          </div>
        </div>
        <button
          className="bankroll-card"
          aria-expanded={showReload}
          aria-label={`Bankroll $${bankroll.toFixed(2)}. Reload bankroll`}
          onClick={() => setShowReload(current => !current)}
        >
          <span>Bankroll</span>
          <strong>${bankroll.toFixed(2)}</strong>
          <small>+ Reload</small>
        </button>
        <div className="header-actions">
          <label className="toggle-label">
            <input type="checkbox" checked={warnStrategy} onChange={() => setWarnStrategy(!warnStrategy)} style={{ accentColor: '#2ecc71' }} /> Guard
          </label>
          <label className="toggle-label">
            <input type="checkbox" checked={showStrategyPopups} onChange={() => setShowStrategyPopups(!showStrategyPopups)} style={{ accentColor: '#3498db' }} /> Popups
          </label>
          <button className="topbar-button is-featured" onClick={() => setShowCheatSheet(true)}>Study Guide</button>
          <button className="topbar-button" onClick={() => setShowCount(!showCount)}>{showCount ? "Hide Count" : "Peek Count"}</button>
          <button className={`topbar-button ${soundEnabled ? 'is-on' : ''}`} onClick={() => setSoundEnabled(current => !current)}>{soundEnabled ? 'Sound on' : 'Sound off'}</button>
          <button className={`topbar-button ${speechEnabled ? 'is-on' : ''}`} onClick={() => setSpeechEnabled(current => !current)}>{speechEnabled ? 'Dealer voice on' : 'Dealer voice off'}</button>
          {(kokoroVoices.length > 0 || availableVoices.length > 0) && (
            <label className="voice-picker">
              <span>
                {voiceModelStatus === 'loading'
                  ? `Loading AI voice${voiceModelProgress ? ` ${voiceModelProgress}%` : '…'}`
                  : voiceModelStatus === 'warming' ? 'AI voice warming up' : 'Voice'}
              </span>
              <select
                aria-label="Dealer voice"
                value={selectedVoiceName}
                onChange={event => setSelectedVoiceName(event.target.value)}
              >
                <optgroup label="Kokoro studio voices · downloads on first use">
                  {kokoroVoices.map(voice => (
                    <option key={voice.id} value={`kokoro:${voice.id}`}>
                      {voice.label}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Fast device voices">
                  {availableVoices.map(voice => (
                    <option key={`${voice.name}-${voice.lang}`} value={voice.name}>
                      {voice.name}
                    </option>
                  ))}
                </optgroup>
              </select>
            </label>
          )}
          <button
            className={`topbar-button voice-toggle ${voiceInputEnabled ? 'is-on' : ''} ${['starting', 'listening', 'hearing', 'processing'].includes(voiceStatus) ? 'is-listening' : ''}`}
            onClick={handleVoiceToggle}
            disabled={!voiceSupported}
            aria-pressed={voiceInputEnabled}
          >
            {voiceSupported
              ? voiceStatus === 'blocked'
                ? 'Mic blocked'
                : voiceStatus === 'hearing'
                  ? 'Hearing you…'
                  : voiceStatus === 'processing'
                    ? 'Processing…'
                    : ['starting', 'listening'].includes(voiceStatus)
                      ? 'Listening…'
                      : voiceInputEnabled ? 'Hands-free on' : 'Hands-free mode'
              : 'Voice unavailable'}
          </button>
          <button className="topbar-button" onClick={() => loggerRef.current.downloadCSV()}>Export</button>
        </div>
      </div>

      {voiceInputEnabled && (
        <div className={`voice-diagnostic is-${voiceStatus}`} role="status" aria-live="polite">
          <span className="voice-level" aria-hidden="true"><i /><i /><i /></span>
          <strong>
            {voiceStatus === 'hearing'
              ? 'Speech detected'
              : voiceStatus === 'processing'
                ? 'Matching command'
                : voiceStatus === 'blocked'
                  ? 'Microphone blocked'
                  : voiceStatus === 'error'
                    ? 'Microphone needs attention'
                    : 'Microphone listening'}
          </strong>
          <span>
            {voiceError
              || (lastHeard ? `Latest transcript: “${lastHeard}”` : 'Say “microphone test” to verify the full recognition path.')}
          </span>
        </div>
      )}

      {showReload && (
        <section className="reload-panel" aria-label="Reload bankroll">
          <div className="reload-copy">
            <span className="eyebrow">Buy in</span>
            <strong>Add practice funds</strong>
          </div>
          <div className="reload-presets" aria-label="Reload presets">
            {[100, 500, 1000].map(amount => (
              <button key={amount} className={reloadAmount === amount ? 'is-selected' : ''} onClick={() => setReloadAmount(amount)}>
                +${amount}
              </button>
            ))}
          </div>
          <label className="reload-custom" htmlFor="reload-amount">
            <span>Custom</span>
            <input
              id="reload-amount"
              aria-label="Custom reload amount"
              type="number"
              min="1"
              max="100000"
              step="100"
              value={reloadAmount}
              onChange={event => setReloadAmount(Number(event.target.value))}
            />
          </label>
          <button className="reload-confirm" onClick={() => addToBankroll()}>Add funds</button>
        </section>
      )}

      {showCount && (
        <div className="count-panel" aria-live="polite">
          <div><span>Running count</span><strong>{shoeRef.current.visibleRunningCount > 0 ? '+' : ''}{shoeRef.current.visibleRunningCount}</strong></div>
          <div><span>True count</span><strong>{shoeRef.current.trueCount > 0 ? '+' : ''}{shoeRef.current.trueCount}</strong></div>
          <div><span>Decks left</span><strong>{Math.max(1, shoeRef.current.cards.length / 52).toFixed(1)}</strong></div>
        </div>
      )}

      {/* GAME BOARD TABLE */}
      <div className="game-board">
        <svg className="table-rule-arc" viewBox="0 0 900 170" aria-hidden="true">
          <defs>
            <path id="table-rule-path" d="M 55 150 Q 450 -90 845 150" />
          </defs>
          <use href="#table-rule-path" className="table-rule-line" />
          <text className="table-rule-copy table-rule-copy-left" dy="-13">
            <textPath href="#table-rule-path" startOffset="19%" textAnchor="middle">INSURANCE PAYS 2 TO 1</textPath>
          </text>
          <text className="table-rule-copy table-rule-copy-center" dy="-15">
            <textPath href="#table-rule-path" startOffset="50%" textAnchor="middle">BLACKJACK PAYS 3 TO 2</textPath>
          </text>
          <text className="table-rule-copy table-rule-copy-right" dy="-13">
            <textPath href="#table-rule-path" startOffset="81%" textAnchor="middle">DEALER MUST HIT SOFT 17</textPath>
          </text>
        </svg>
        {gameState === 'shuffling' ? (
          <div className="shuffle-state"><span>♠</span> Reshuffling shoe…</div>
        ) : (
          <>
            {/* DEALER AREA */}
            <div className="hand-zone dealer-zone">
              <div className="zone-label">
                <span>Dealer</span>
                <strong>
                  {gameState === 'playing' || gameState === 'insurance' || gameState === 'evenMoney'
                    ? dealerHand.length ? calculateTotal([dealerHand[0]]) : '—'
                    : dealerHand.length > 0 ? calculateTotal(dealerHand) : '—'}
                </strong>
              </div>
              <div className="card-row dealer-cards">
                {gameState === 'betting' ? (
                  <div className="shoe-placeholder">
                    <span>♠</span>
                    <small>SHOE READY</small>
                  </div>
                ) : (
                  dealerHand.map((card, i) => {
                    const hidden = (gameState === 'playing' || gameState === 'insurance' || gameState === 'evenMoney') && i === 1;
                    return <PlayingCard key={i} card={card} hidden={hidden} delay={i * 90} />;
                  })
                )}
              </div>
            </div>

            {/* PLAYER SPOTS */}
            <div className="hand-zone player-zone">
              <div className="zone-label"><span>Your hands</span><strong>{playerSpots.reduce((sum, spot) => sum + spot.subHands.length, 0) || '—'}</strong></div>
              <div className="player-spots" style={{ display: 'flex', gap: '3rem', justifyContent: 'center', minHeight: '130px' }}>
                {gameState === 'betting' ? (
                  <div className="betting-prompt">
                    <span>PLACE YOUR WAGER</span>
                    <small>Choose separate wagers and the number of spots below</small>
                  </div>
                ) : (
                  playerSpots.map((spot, sIdx) => (
                    <div key={sIdx} className="spot-group">
                      {spot.subHands.map((hand, hIdx) => {
                        const isActive = sIdx === activeSpotIndex && hIdx === activeSubHandIndex && gameState === 'playing';
                        const isNaturalBJ = isNaturalBlackjack(hand);
                        return (
                          <div key={hIdx} className={`player-hand ${isActive ? 'is-active' : ''} ${hand.outcome ? `is-${hand.outcome}` : ''}`}>
                            <div className="hand-meta">
                              <span>{spot.subHands.length > 1 ? `Split hand ${hIdx + 1}` : `Spot ${sIdx + 1}`}</span>
                              {hand.outcome && <b>{hand.outcome}</b>}
                            </div>
                            <div className="hand-cards">
                                {hand.cards.map((card, cIdx) => (
                                  <PlayingCard key={cIdx} card={card} compact delay={cIdx * 70} />
                                ))}
                            </div>
                            <div className="hand-total">
                              <span>{isNaturalBJ ? 'Blackjack' : 'Total'}</span>
                              <strong>{calculateTotal(hand.cards)}</strong>
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
      {evenMoneyQueue.length > 0 ? (
        <div className="decision-bar">
          <div className="decision-copy">
            <span className="decision-kicker">Spot {evenMoneyQueue[0].spotIndex + 1} · Blackjack</span>
            <strong>Take guaranteed even money?</strong>
            <small>Dealer shows an Ace. This choice applies only to this hand.</small>
          </div>
          <button className="decision-button is-gold" onClick={() => executeEvenMoney(true)}>Take 1:1</button>
          <button className="decision-button" onClick={() => executeEvenMoney(false)}>Play it out</button>
        </div>
      ) : (
        <GameControls
          gameState={gameState}
          spotBets={spotBets}
          setSpotBet={updateSpotBet}
          numHands={numHands}
          setNumHands={updateSpotCount}
          onDeal={deal}
          onHit={() => handleAction('hit')}
          onStand={() => handleAction('stand')}
          onDouble={() => handleAction('double')}
          onSplit={() => handleAction('split')}
          canDouble={getCurrentActiveHand()?.cards.length === 2}
          canSplit={canSplitCurrent()}
          canResplit={(playerSpots[activeSpotIndex]?.subHands.length || 0) > 1}
          onInsurance={executeInsurance}
          onNextRound={beginNextRound}
          lastHeard={lastHeard}
          onToggleVoiceInput={handleVoiceToggle}
          voiceInputEnabled={voiceInputEnabled}
          voiceError={voiceError}
          voiceStatus={voiceStatus}
          voiceSupported={voiceSupported}
        />
      )}
    </main>
  );
}
