import { useEffect, useState, useRef } from 'react';
import { Shoe } from './models/Shoe';
import { calculateTotal, getDetailedPlay } from './utils/strategyEngine';
import {
  applyEvenMoneyDecision,
  canSurrenderHand,
  canSplitHand,
  findNextPlayableHand,
  getEvenMoneyOffers,
  getInsuranceBets,
  getNaturalBlackjackSettlement,
  isNaturalBlackjack,
  splitHand,
  surrenderHand,
} from './utils/handRules';
import { GameLogger } from './utils/logger';
import CheatSheet from './components/CheatSheet';
import PopupModal from './components/PopupModal';
import GameControls from './components/GameControls';
import PlayingCard from './components/PlayingCard';
import SessionChart from './components/SessionChart';
import BankrollScore from './components/BankrollScore';
import SettingsDrawer from './components/SettingsDrawer';
import CountDrillModal from './components/CountDrillModal';
import ShoeTray from './components/ShoeTray';
import DealerShoe from './components/DealerShoe';
import ChipRack from './components/ChipRack';
import useTableVoice from './hooks/useTableVoice';
import {
  getSpokenCountSummary,
  getSpokenHandTotal,
} from './utils/tableSpeech';
import { getKeyboardCommand } from './utils/keyboardShortcuts';
import { BET_UNIT, isValidTableWager, TABLE_MAX_BET, TABLE_MIN_BET } from './utils/betSizing';
import { DEFAULT_RULES, normalizeRules } from './utils/tableRules';
import { getSpreadBet, normalizeBetSpread } from './utils/betSpread';
import {
  calculateRealizedPnl,
  getUnresolvedHandWager,
  STARTING_BANKROLL,
} from './utils/sessionAccounting';
import { loadSessionState, saveSessionState } from './utils/persistence';
import {
  loadProfile,
  recordDecisions,
  recordDrill,
  recordFullTableCasinoRound,
  recordHands,
  recordSessionPnl,
  recordShoe,
  saveProfile,
  startNewSession,
} from './utils/profile';

const TABLE_PACE_MS = { slow: 6000, medium: 3500, fast: 2000, pro: 1200 };
const TABLE_PACES = ['manual', 'slow', 'medium', 'fast', 'pro'];
const AI_ACTION_MS = { fast: 900, manual: 1600, medium: 1400, pro: 550, slow: 2000 };
const AI_SEAT_COUNTS = [0, 2, 4];
const AI_SEAT_ROSTER = [
  { name: 'Lena', position: 'pre' },
  { name: 'Marcus', position: 'pre' },
  { name: 'Priya', position: 'post' },
  { name: 'Walt', position: 'post' },
];
const AI_BET_OPTIONS = [25, 25, 50, 50, 75, 100];
const DEAL_STEP_MS = 150;

const getAiSeatsForCount = (count) => (
  count === 2
    ? [AI_SEAT_ROSTER[0], AI_SEAT_ROSTER[3]]
    : count === 4 ? AI_SEAT_ROSTER : []
);

const getChipColor = (denom) => {
  if (denom >= 1000) return '#f39c12';
  if (denom >= 500) return '#8e7cc3';
  if (denom >= 100) return '#1c1c1c';
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

const CONFETTI_PARTICLES = Array.from({ length: 720 }, (_, index) => ({
  color: ['#facc15', '#fb7185', '#38bdf8', '#4ade80', '#c084fc', '#f97316'][index % 6],
  delay: `${(index % 40) * 34}ms`,
  drift: `${((index * 47) % 560) - 280}px`,
  left: `${1 + ((index * 37) % 98)}%`,
  rotation: `${360 + ((index * 83) % 1080)}deg`,
  scale: 0.7 + (index % 7) * 0.1,
}));

const SICK_REACTION_PARTICLES = Array.from({ length: 150 }, (_, index) => ({
  delay: `${(index % 22) * 58}ms`,
  drift: `${((index * 61) % 460) - 230}px`,
  emoji: index % 3 === 0 ? '🤢' : '🤮',
  left: `${1 + ((index * 43) % 98)}%`,
  size: `${1.8 + (index % 8) * 0.28}rem`,
}));

const formatCards = cards => cards.map(card => `${card.value}${card.suit}`).join(' ');

export default function App() {
  const shoeRef = useRef(null);
  if (!shoeRef.current) {
    const initialRules = normalizeRules(loadSessionState()?.rules ?? DEFAULT_RULES);
    shoeRef.current = new Shoe(initialRules.decks, initialRules.penetration);
  }
  const loggerRef = useRef(new GameLogger());
  const handleActionRef = useRef(null);
  const keyboardActionRef = useRef(null);
  const voiceCommandRef = useRef(null);
  
  const [restored] = useState(loadSessionState);
  const [profile, setProfile] = useState(loadProfile);
  const profileDeltaRef = useRef({ decisions: null, hands: null, mistakes: null });
  const [rules, setRules] = useState(() => normalizeRules(restored?.rules));
  const [betSpread, setBetSpread] = useState(() => normalizeBetSpread(restored?.betSpread));
  const [bankroll, setBankroll] = useState(() => (
    Number.isFinite(restored?.bankroll) && restored.bankroll >= 0 ? restored.bankroll : STARTING_BANKROLL
  ));
  const [totalBuyIns, setTotalBuyIns] = useState(() => (
    Number.isFinite(restored?.totalBuyIns) && restored.totalBuyIns >= 0 ? restored.totalBuyIns : 0
  ));
  const [spotBets, setSpotBets] = useState(() => (
    Array.isArray(restored?.spotBets) && restored.spotBets.length >= 2
      ? restored.spotBets.slice(0, 2).map(bet => (Number.isFinite(bet) ? bet : 25))
      : [25, 25]
  ));
  const [numHands, setNumHands] = useState(() => (restored?.numHands === 2 ? 2 : 1));
  const [showReload, setShowReload] = useState(false);
  const [showSession, setShowSession] = useState(false);
  const [reloadAmount, setReloadAmount] = useState(() => (
    Number.isFinite(restored?.reloadAmount) && restored.reloadAmount > 0 ? restored.reloadAmount : 500
  ));

  const [gameState, setGameState] = useState('betting');
  const [playerSpots, setPlayerSpots] = useState([]);
  const [activeSpotIndex, setActiveSpotIndex] = useState(0);
  const [activeSubHandIndex, setActiveSubHandIndex] = useState(0);
  const [dealerHand, setDealerHand] = useState([]);
  const [showCount, setShowCount] = useState(false);
  const [showCheatSheet, setShowCheatSheet] = useState(false);
  const [sessionHands, setSessionHands] = useState(() => (
    Array.isArray(restored?.sessionHands) ? restored.sessionHands : []
  ));
  const [strategyDecisions, setStrategyDecisions] = useState(() => (
    Number.isFinite(restored?.strategyDecisions) ? restored.strategyDecisions : 0
  ));
  const [strategyMistakes, setStrategyMistakes] = useState(() => (
    Number.isFinite(restored?.strategyMistakes) ? restored.strategyMistakes : 0
  ));
  const [showSettings, setShowSettings] = useState(false);
  const [tablePace, setTablePace] = useState(() => (
    TABLE_PACES.includes(restored?.tablePace) ? restored.tablePace : 'manual'
  ));
  const [countDrillEnabled, setCountDrillEnabled] = useState(() => (
    typeof restored?.countDrillEnabled === 'boolean' ? restored.countDrillEnabled : true
  ));
  const [countDrillStats, setCountDrillStats] = useState(() => (
    Number.isFinite(restored?.countDrillStats?.attempts)
      ? { attempts: restored.countDrillStats.attempts, exact: restored.countDrillStats.exact || 0 }
      : { attempts: 0, exact: 0 }
  ));
  const [countDrill, setCountDrill] = useState(null);
  const [aiSeatCount, setAiSeatCount] = useState(() => (
    AI_SEAT_COUNTS.includes(restored?.aiSeatCount) ? restored.aiSeatCount : 0
  ));
  const [aiPlayers, setAiPlayers] = useState([]);
  const aiPlayersRef = useRef([]);
  const aiPreDoneRef = useRef(false);
  const aiPostDoneRef = useRef(false);
  const tablePaceRef = useRef('manual');
  const [celebrationKey, setCelebrationKey] = useState(0);
  const [sickReactionKey, setSickReactionKey] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hintedAction, setHintedAction] = useState(null);
  const [insuranceBets, setInsuranceBets] = useState([]);
  const [evenMoneyQueue, setEvenMoneyQueue] = useState([]);
  
  const [warnStrategy, setWarnStrategy] = useState(() => (
    typeof restored?.warnStrategy === 'boolean' ? restored.warnStrategy : true
  ));
  const [showStrategyPopups, setShowStrategyPopups] = useState(() => (
    typeof restored?.showStrategyPopups === 'boolean' ? restored.showStrategyPopups : true
  ));
  const [warnBetSizing, setWarnBetSizing] = useState(() => (
    typeof restored?.warnBetSizing === 'boolean' ? restored.warnBetSizing : false
  ));
  const [pendingAction, setPendingAction] = useState(null);

  const {
    announce,
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
    isListeningAllowed: !['dealerRevealing', 'shuffling', 'aiPlaying', 'dealing'].includes(gameState),
    onCommand: command => voiceCommandRef.current?.(command),
  });

  tablePaceRef.current = tablePace;

  const syncAiPlayers = (seats) => {
    aiPlayersRef.current = seats;
    setAiPlayers(seats);
  };

  const updateAiSeat = (index, changes) => {
    const seats = aiPlayersRef.current.map((seat, seatIndex) => (
      seatIndex === index ? { ...seat, ...changes } : seat
    ));
    syncAiPlayers(seats);
  };

  // Companions play plain basic strategy — no deviations, no surrender, and
  // pairs are played as hard totals to keep single-hand seats.
  const getAiDecision = (cards, dealerUpCard) => {
    const evaluation = getDetailedPlay(cards, dealerUpCard, 0, { allowSurrender: false, ignoreDeviations: true, rules });
    let action = evaluation.action;
    if (action === 'split') {
      const total = calculateTotal(cards);
      const dealerValue = dealerUpCard.numericValue;
      if (total >= 17) action = 'stand';
      else if (total >= 13) action = dealerValue >= 2 && dealerValue <= 6 ? 'stand' : 'hit';
      else if (total === 12) action = dealerValue >= 4 && dealerValue <= 6 ? 'stand' : 'hit';
      else action = 'hit';
    }
    if (action === 'double' && cards.length > 2) action = 'hit';
    return action;
  };

  const playAiSeats = async (position, dealerUpCard) => {
    const delayMs = AI_ACTION_MS[tablePaceRef.current] ?? 1400;
    for (let index = 0; index < aiPlayersRef.current.length; index++) {
      if (aiPlayersRef.current[index].position !== position) continue;
      updateAiSeat(index, { status: 'acting' });
      let cards = aiPlayersRef.current[index].cards;
      for (;;) {
        await new Promise(r => setTimeout(r, delayMs));
        const action = getAiDecision(cards, dealerUpCard);
        if (action === 'stand') break;
        const card = shoeRef.current.draw();
        shoeRef.current.visibleRunningCount += card.countValue;
        playSound('card');
        cards = [...cards, card];
        updateAiSeat(index, { cards });
        if (calculateTotal(cards) > 21 || action === 'double') break;
      }
      updateAiSeat(index, { status: 'done' });
    }
  };

  const runPreSeatTurns = async (dealerUpCard) => {
    if (!aiPlayersRef.current.length || aiPreDoneRef.current) return;
    aiPreDoneRef.current = true;
    setGameState('aiPlaying');
    await playAiSeats('pre', dealerUpCard);
  };

  const resolveAiOutcomes = (dealerCards) => {
    if (!aiPlayersRef.current.length) return;
    const dealerTotal = calculateTotal(dealerCards);
    const dealerBlackjack = dealerTotal === 21 && dealerCards.length === 2;
    syncAiPlayers(aiPlayersRef.current.map((seat) => {
      const total = calculateTotal(seat.cards);
      let outcome;
      if (total > 21) outcome = 'loss';
      else if (dealerBlackjack) outcome = total === 21 && seat.cards.length === 2 ? 'push' : 'loss';
      else if (dealerTotal > 21 || total > dealerTotal) outcome = 'win';
      else if (total < dealerTotal) outcome = 'loss';
      else outcome = 'push';
      return { ...seat, outcome, status: 'done' };
    }));
  };

  useEffect(() => {
    const syncFullscreen = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', syncFullscreen);
    syncFullscreen();
    return () => document.removeEventListener('fullscreenchange', syncFullscreen);
  }, []);

  const announcePlayerTurn = (spots, spotIndex, handIndex, lead = '') => {
    const spot = spots[spotIndex];
    const hand = spot?.subHands[handIndex];
    if (!hand) return;
    const calls = Array.isArray(lead) ? lead : lead ? [lead] : [];
    if (calls.some(call => String(call).toLowerCase().includes('too many'))) {
      announce('Too many.', { listenAfter: true });
    }
  };

  const addToBankroll = (amountOverride) => {
    const amount = Number(amountOverride ?? reloadAmount);
    if (!Number.isFinite(amount) || amount <= 0) return;
    const safeAmount = Math.min(amount, 100000);
    setBankroll(current => current + safeAmount);
    setTotalBuyIns(current => current + safeAmount);
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

  const addChipToBet = (denomination, spotIndex = 0) => {
    if (gameState !== 'betting') return;
    if (spotIndex < 0 || spotIndex >= numHands) return;
    const otherWagers = spotBets.slice(0, numHands).reduce((sum, bet, index) => sum + (index === spotIndex ? 0 : bet), 0);
    const currentBet = spotBets[spotIndex] || 0;
    const nextBet = Math.min(TABLE_MAX_BET, currentBet + denomination);
    if (otherWagers + nextBet > bankroll) {
      announce('Not enough chips in the rack for that wager.', { listenAfter: true });
      return;
    }
    playSound('chips');
    updateSpotBet(spotIndex, nextBet);
  };

  const removeChipFromBet = (denomination, spotIndex = 0) => {
    if (gameState !== 'betting') return;
    const currentBet = spotBets[spotIndex] || 0;
    const nextBet = Math.max(TABLE_MIN_BET, Math.round((currentBet - denomination) * 2) / 2);
    if (nextBet === currentBet) return;
    playSound('chips');
    updateSpotBet(spotIndex, nextBet);
  };

  const updateSpotCount = (count) => {
    const safeCount = count === 2 ? 2 : 1;
    setNumHands(safeCount);
    setSpotBets(current => (
      safeCount === 2 && current.length < 2 ? [current[0] || 25, current[0] || 25] : current
    ));
  };

  const logRoundResults = (finalDealerHand, spots, finalInsuranceBets = []) => {
    const dealerTotal = calculateTotal(finalDealerHand);
    const dealerBlackjack = dealerTotal === 21 && finalDealerHand.length === 2;
    const settledHands = [];
    const closingTrueCount = shoeRef.current.trueCount;
    spots.forEach((spot, spotIndex) => {
      spot.subHands.forEach((hand, handIndex) => {
        let returnAmount = 0;
        if (hand.outcome === 'push') returnAmount = hand.bet;
        if (hand.outcome === 'surrender') returnAmount = hand.bet / 2;
        if (hand.outcome === 'win') {
          returnAmount = isNaturalBlackjack(hand) && !hand.evenMoneyAccepted
            ? hand.bet * (1 + rules.blackjackPayout)
            : hand.bet * 2;
        }
        const insuranceBet = handIndex === spot.subHands.length - 1
          ? finalInsuranceBets[spotIndex] || 0
          : 0;
        const insuranceReturn = insuranceBet > 0 && dealerBlackjack ? insuranceBet * 3 : 0;
        const handNet = returnAmount - hand.bet + insuranceReturn - insuranceBet;
        settledHands.push({ net: handNet, trueCount: closingTrueCount });
        loggerRef.current.log(
          'ROUND_RESULT',
          `Spot ${spotIndex + 1}, hand ${handIndex + 1}: ${hand.outcome}; player ${calculateTotal(hand.cards)}, dealer ${dealerTotal}.`,
          {
            dealerCards: formatCards(finalDealerHand),
            dealerTotal,
            decksRemaining: shoeRef.current.decksRemaining.toFixed(2),
            hand: handIndex + 1,
            insurance: finalInsuranceBets[spotIndex] || 0,
            net: returnAmount - hand.bet,
            outcome: hand.outcome,
            playerCards: formatCards(hand.cards),
            playerTotal: calculateTotal(hand.cards),
            returnAmount,
            runningCount: shoeRef.current.visibleRunningCount,
            spot: spotIndex + 1,
            trueCount: shoeRef.current.trueCount,
            wager: hand.bet,
          },
        );
      });
      const insuranceBet = finalInsuranceBets[spotIndex] || 0;
      if (insuranceBet > 0) {
        const insuranceReturn = dealerBlackjack ? insuranceBet * 3 : 0;
        loggerRef.current.log(
          'INSURANCE_RESULT',
          `Spot ${spotIndex + 1} insurance ${dealerBlackjack ? 'won' : 'lost'}.`,
          {
            dealerCards: formatCards(finalDealerHand),
            dealerTotal,
            insurance: insuranceBet,
            net: insuranceReturn - insuranceBet,
            outcome: dealerBlackjack ? 'win' : 'loss',
            returnAmount: insuranceReturn,
            spot: spotIndex + 1,
          },
        );
      }
    });
    setSessionHands(current => {
      let cumulativePnl = current.at(-1)?.cumulativePnl || 0;
      const nextHands = settledHands.map((hand, index) => {
        cumulativePnl += hand.net;
        return {
          ...hand,
          cumulativePnl,
          handNumber: current.length + index + 1,
        };
      });
      return [...current, ...nextHands];
    });
  };

  const deal = async (betsOverride = null, { skipBetWarning = false, skipCountDrill = false } = {}) => {
    const activeBets = Array.isArray(betsOverride)
      ? betsOverride.slice(0, numHands)
      : spotBets.slice(0, numHands);
    const totalWager = activeBets.reduce((sum, bet) => sum + bet, 0);
    if (activeBets.some(bet => !isValidTableWager(bet))) {
      announce('Each spot needs a wager from 5 to 10000 dollars.', { listenAfter: true });
      return;
    }
    if (bankroll < totalWager) {
      announce(`Insufficient funds. The wagers total ${totalWager} dollars and the bankroll is ${bankroll} dollars.`, { listenAfter: true });
      return;
    }

    if (shoeRef.current.configure(rules.decks, rules.penetration)) {
      loggerRef.current.log('SHUFFLE', `Table rules changed: new ${rules.decks}-deck shoe.`);
    }

    const sizingTrueCount = shoeRef.current.needsShuffle() ? 0 : shoeRef.current.trueCount;
    const recommendedWager = Math.max(BET_UNIT, getSpreadBet(betSpread, sizingTrueCount));
    const hasSizingMistake = activeBets.some(bet => bet !== recommendedWager);
    if (warnBetSizing && !skipBetWarning) {
      if (hasSizingMistake && showStrategyPopups) {
        setStrategyDecisions(current => current + 1);
        setStrategyMistakes(current => current + 1);
        setPendingAction({
          bets: activeBets,
          category: 'Bet sizing',
          intended: 'deal',
          optimal: `$${recommendedWager} per spot`,
          recommendedWager,
          revealHint: true,
          rule: `At true count ${sizingTrueCount >= 0 ? '+' : ''}${sizingTrueCount}, your bet spread calls for $${recommendedWager} on each active spot. Edit the spread in the Study Guide → Bet spread.`,
          type: 'betSizing',
        });
        announce(
          `Bet sizing warning. True count ${sizingTrueCount}. Recommended wager ${recommendedWager} dollars per spot.`,
          { listenAfter: true },
        );
        return;
      }
      setStrategyDecisions(current => current + 1);
      if (hasSizingMistake) setStrategyMistakes(current => current + 1);
    }

    if (shoeRef.current.needsShuffle()) {
      if (countDrillEnabled && !skipCountDrill) {
        setCountDrill({
          actual: shoeRef.current.visibleRunningCount,
          bets: activeBets,
          decksRemaining: shoeRef.current.decksRemaining,
          trueCount: shoeRef.current.trueCount,
        });
        setGameState('countDrill');
        announce('Shuffle check. What is your running count?');
        return;
      }
      setGameState('shuffling');
      loggerRef.current.log('SHUFFLE', 'Shoe penetration limit reached, reshuffling shoe.');
      setProfile(current => recordShoe(current));
      await new Promise(r => setTimeout(r, 2000));
      shoeRef.current.buildAndShuffle();
    }

    setBankroll(b => b - totalWager);
    playSound('deal');
    setInsuranceBets(new Array(numHands).fill(0));
    setEvenMoneyQueue([]);
    aiPreDoneRef.current = false;
    aiPostDoneRef.current = false;

    const d1 = shoeRef.current.draw();
    shoeRef.current.visibleRunningCount += d1.countValue;

    const aiSeats = getAiSeatsForCount(aiSeatCount).map((seat) => {
      const c1 = shoeRef.current.draw();
      const c2 = shoeRef.current.draw();
      shoeRef.current.visibleRunningCount += c1.countValue + c2.countValue;
      return {
        ...seat,
        bet: AI_BET_OPTIONS[Math.floor(Math.random() * AI_BET_OPTIONS.length)],
        cards: [c1, c2],
        outcome: null,
        status: 'waiting',
      };
    });
    syncAiPlayers(aiSeats);

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
          isSplitHand: false,
          doubleCardFaceDown: false,
          doubleCardPeeling: false,
        }]
      });
    }
    const d2 = shoeRef.current.draw();
    setDealerHand([d1, d2]);
    loggerRef.current.log(
      'DEAL',
      `Opened ${numHands} ${numHands === 1 ? 'spot' : 'spots'} for $${totalWager}.`,
      {
        bankroll: bankroll - totalWager,
        dealerCards: `${formatCards([d1])} [hole]`,
        decksRemaining: shoeRef.current.decksRemaining.toFixed(2),
        playerCards: spots.map(spot => formatCards(spot.subHands[0].cards)).join(' | '),
        runningCount: shoeRef.current.visibleRunningCount,
        trueCount: shoeRef.current.trueCount,
        wager: totalWager,
      },
    );

    // Let the dealer pitch the cards around the table before any decisions.
    setPlayerSpots(spots);
    setGameState('dealing');
    const seatsInDeal = aiSeats.length + numHands + 1;
    await new Promise(r => setTimeout(r, seatsInDeal * 2 * DEAL_STEP_MS + 260));

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
          `Dealer shows an ace. Spot ${evenMoneyOffers[0].spotIndex + 1} has blackjack. Even money decision pending.`,
          { listenAfter: true },
        );
        return;
      }
      setGameState('insurance');
      announce('Dealer shows an ace. Insurance decision pending.', { listenAfter: true });
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

      resolveAiOutcomes([d1, d2]);
      setBankroll(b => b + netReturn);
      setGameState('resolved');
      logRoundResults([d1, d2], spots);
      playSound(netReturn > 0 ? 'chips' : 'loss');
      return;
    }

    let payoutReturn = 0;
    spots.forEach((spot, sIdx) => {
      const h = spot.subHands[0];
      const isBJ = isNaturalBlackjack(h);

      if (isBJ) {
        h.outcome = 'win';
        payoutReturn += h.bet + (h.bet * rules.blackjackPayout);
        loggerRef.current.log('BLACKJACK', `Spot ${sIdx+1} natural Blackjack for +$${h.bet * rules.blackjackPayout}`);
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
      logRoundResults([d1, d2], spots);
      playSound('win');
    } else {
      await runPreSeatTurns(d1);
      findFirstActiveHand(
        spots,
        0,
        0,
        payoutReturn,
        totalWager,
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
        `Spot ${remainingOffers[0].spotIndex + 1} has blackjack. Even money decision pending.`,
        { listenAfter: true },
      );
      return;
    }

    const hasInsuranceEligibleHand = spots.some(spot => (
      spot.subHands.some(hand => !isNaturalBlackjack(hand))
    ));
    if (hasInsuranceEligibleHand) {
      setGameState('insurance');
      announce('Even money decisions complete. Insurance decision pending.', { listenAfter: true });
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
    loggerRef.current.log(
      buy ? 'INSURANCE' : 'INSURANCE_DECLINED',
      buy ? `Purchased $${insTotalCost} of insurance.` : 'Insurance declined.',
      {
        insurance: insTotalCost,
        wager: spotsOverride.reduce(
          (sum, spot) => sum + (spot.subHands[0]?.bet || 0),
          0,
        ),
      },
    );

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
          const settlement = getNaturalBlackjackSettlement(hand, true, rules.blackjackPayout);
          if (settlement) {
            hand.outcome = settlement.outcome;
            hand.status = 'stood';
            netReturn += settlement.returnAmount;
          }
        });
      });
      setPlayerSpots(spots);
      resolveAiOutcomes(dealerHand);
      setBankroll(b => b + netReturn);
      setGameState('resolved');
      logRoundResults(dealerHand, spots, nextInsuranceBets);
      playSound(netReturn > 0 ? 'chips' : 'loss');
    } else {
      const spots = JSON.parse(JSON.stringify(spotsOverride));
      let winnings = 0;
      spots.forEach((spot) => {
        spot.subHands.forEach(h => {
          const settlement = getNaturalBlackjackSettlement(h, false, rules.blackjackPayout);
          if (settlement) {
            h.outcome = settlement.outcome;
            winnings += settlement.returnAmount;
            h.status = 'stood';
          }
        });
      });
      setPlayerSpots(spots);
      await runPreSeatTurns(dealerHand[0]);
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
    loggerRef.current.log(
      'HIT',
      `Spot ${activeSpotIndex + 1}, hand ${activeSubHandIndex + 1} drew ${formatCards([drawnCard])} for ${total}.`,
      {
        decksRemaining: shoeRef.current.decksRemaining.toFixed(2),
        hand: activeSubHandIndex + 1,
        playerCards: formatCards(hand.cards),
        playerTotal: total,
        runningCount: shoeRef.current.visibleRunningCount,
        spot: activeSpotIndex + 1,
        trueCount: shoeRef.current.trueCount,
        wager: hand.bet,
      },
    );
    
    if (total > 21) {
      hand.status = 'bust';
      hand.outcome = 'loss';
      advancePointer(spots, false, 'Too many.');
    } else if (total === 21 || hand.isSplitAce) {
      hand.status = 'stood';
      advancePointer(spots);
    } else {
      setPlayerSpots(spots);
    }
  };

  const executeStand = () => {
    let spots = JSON.parse(JSON.stringify(playerSpots));
    const hand = spots[activeSpotIndex].subHands[activeSubHandIndex];
    hand.status = 'stood';
    playSound('stand');
    loggerRef.current.log(
      'STAND',
      `Spot ${activeSpotIndex + 1}, hand ${activeSubHandIndex + 1} stood on ${calculateTotal(hand.cards)}.`,
      {
        hand: activeSubHandIndex + 1,
        playerCards: formatCards(hand.cards),
        playerTotal: calculateTotal(hand.cards),
        spot: activeSpotIndex + 1,
        wager: hand.bet,
      },
    );
    advancePointer(spots);
  };

  const executeSurrender = () => {
    const spots = JSON.parse(JSON.stringify(playerSpots));
    const current = spots[activeSpotIndex]?.subHands[activeSubHandIndex];
    if (!canSurrenderHand(current)) {
      announce('Late surrender is only available on the original two-card hand.', {
        listenAfter: true,
      });
      return;
    }

    const settlement = surrenderHand(current);
    spots[activeSpotIndex].subHands[activeSubHandIndex] = settlement.hand;
    setBankroll(currentBankroll => currentBankroll + settlement.returnAmount);
    playSound('stand');
    loggerRef.current.log(
      'SURRENDER',
      `Spot ${activeSpotIndex + 1}, hand ${activeSubHandIndex + 1} surrendered for a $${settlement.returnAmount} return.`,
      {
        hand: activeSubHandIndex + 1,
        net: -settlement.returnAmount,
        outcome: 'surrender',
        playerCards: formatCards(current.cards),
        playerTotal: calculateTotal(current.cards),
        returnAmount: settlement.returnAmount,
        spot: activeSpotIndex + 1,
        wager: current.bet,
      },
    );
    advancePointer(spots, false, 'Hand surrendered. Half the wager returned.');
  };

  const executeDouble = (faceDown = false) => {
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
    if (!faceDown) shoeRef.current.visibleRunningCount += drawnCard.countValue;
    hand.cards.push(drawnCard);
    hand.doubleCardFaceDown = faceDown;
    hand.doubleCardPeeling = false;
    const total = calculateTotal(hand.cards);
    
    if (total > 21) {
      hand.status = 'bust';
      hand.outcome = 'loss';
    } else {
      hand.status = 'stood';
    }
    loggerRef.current.log(
      faceDown ? 'DOUBLE_FACE_DOWN' : 'DOUBLE',
      faceDown
        ? `Spot ${activeSpotIndex + 1}, hand ${activeSubHandIndex + 1} doubled; card held face down.`
        : `Spot ${activeSpotIndex + 1}, hand ${activeSubHandIndex + 1} doubled and drew ${formatCards([drawnCard])} for ${total}.`,
      {
        hand: activeSubHandIndex + 1,
        playerCards: faceDown ? `${formatCards(hand.cards.slice(0, -1))} [face down]` : formatCards(hand.cards),
        playerTotal: faceDown ? '' : total,
        spot: activeSpotIndex + 1,
        wager: hand.bet,
      },
    );
    advancePointer(
      spots,
      false,
      faceDown
        ? ''
        : total > 21 ? 'Too many.' : '',
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
    loggerRef.current.log(
      'SPLIT',
      `Spot ${activeSpotIndex + 1} split into ${spot.subHands.length} hands.`,
      {
        playerCards: spot.subHands.map(split => formatCards(split.cards)).join(' | '),
        spot: activeSpotIndex + 1,
        wager: hand.bet,
      },
    );

    advancePointer(
      spots,
      true,
      'Cards split.',
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
    if (aiPlayersRef.current.length && !aiPostDoneRef.current) {
      aiPostDoneRef.current = true;
      setGameState('aiPlaying');
      await playAiSeats('post', dInitialHand[0]);
    }
    setGameState('dealerRevealing');
    shoeRef.current.visibleRunningCount += dInitialHand[1].countValue;

    let dHand = [...dInitialHand];
    await new Promise(r => setTimeout(r, 650));

    const dealerHasBlackjack = calculateTotal(dHand) === 21 && dHand.length === 2;
    const needsDealerDraw = spots.some(spot => spot.subHands.some(hand => (
      hand.doubleCardFaceDown
      || (hand.status === 'stood' && !isNaturalBlackjack(hand))
    ))) || aiPlayersRef.current.some(seat => calculateTotal(seat.cards) <= 21);

    if (needsDealerDraw && !dealerHasBlackjack) {
      while (calculateTotal(dHand) < 17 || (rules.dealerHitsSoft17 && isSoft17(dHand))) {
        await new Promise(r => setTimeout(r, 550));
        const drawnCard = shoeRef.current.draw();
        playSound('card');
        shoeRef.current.visibleRunningCount += drawnCard.countValue;
        dHand.push(drawnCard);
        setDealerHand([...dHand]);
      }
    }

    let revealedSpots = spots;
    const faceDownDoubles = spots.flatMap((spot, spotIndex) => (
      spot.subHands.flatMap((hand, handIndex) => (
        hand.doubleCardFaceDown ? [{ hand, handIndex, spotIndex }] : []
      ))
    ));
    if (faceDownDoubles.length > 0) {
      revealedSpots = spots.map(spot => ({
        ...spot,
        subHands: spot.subHands.map(hand => ({
          ...hand,
          doubleCardFaceDown: false,
          doubleCardPeeling: Boolean(hand.doubleCardFaceDown),
        })),
      }));
      faceDownDoubles.forEach(({ hand }) => {
        const doubleCard = hand.cards[hand.cards.length - 1];
        shoeRef.current.visibleRunningCount += doubleCard.countValue;
      });
      setPlayerSpots(revealedSpots);
      playSound('card');
      await new Promise(r => setTimeout(r, 950));
      if (faceDownDoubles.some(({ hand }) => calculateTotal(hand.cards) > 21)) {
        await announce('Too many.');
      }
    }

    resolveRound(dHand, revealedSpots, insBets, presetWinnings, totalWager);
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
        if (hand.status === 'surrendered') {
          hand.outcome = 'surrender';
          return;
        }
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

    resolveAiOutcomes(dHand);
    logRoundResults(dHand, spots, insBets);
    setBankroll(b => b + totalReturn);
    setGameState('resolved');
    const outcomes = spots.flatMap(spot => spot.subHands.map(hand => hand.outcome));
    playSound(outcomes.includes('win') ? 'win' : outcomes.every(outcome => outcome === 'loss') ? 'loss' : 'chips');
    if (dTotal > 21) announce('Too many.', { listenAfter: true });
  };

  const executeRequestedAction = (actionType) => {
    if (actionType === 'hit') return executeHit();
    if (actionType === 'stand') return executeStand();
    if (actionType === 'double') return executeDouble(false);
    if (actionType === 'doubleFaceDown') return executeDouble(true);
    if (actionType === 'split') return executeSplit();
    if (actionType === 'surrender') return executeSurrender();
    return undefined;
  };

  const handleAction = (actionType) => {
    setHintedAction(null);
    const curHand = getCurrentActiveHand();
    if (!warnStrategy) return executeRequestedAction(actionType);

    const evaluation = getDetailedPlay(
      curHand.cards,
      dealerHand[0],
      shoeRef.current.trueCount,
      {
        allowSurrender: rules.lateSurrender && canSurrenderHand(curHand),
        rules,
        runningCount: shoeRef.current.visibleRunningCount,
      },
    );
    let optimal = evaluation.action;
    if (optimal === 'double' && curHand.cards.length > 2) optimal = calculateTotal(curHand.cards) >= 18 ? 'stand' : 'hit';
    const strategyAction = actionType === 'doubleFaceDown' ? 'double' : actionType;
    
    if (strategyAction !== optimal) {
      if (!showStrategyPopups) {
        setStrategyDecisions(current => current + 1);
        setStrategyMistakes(current => current + 1);
        executeRequestedAction(actionType);
      } else {
        setStrategyDecisions(current => current + 1);
        setStrategyMistakes(current => current + 1);
        setPendingAction({
          intended: actionType,
          optimal,
          type: 'play',
          category: evaluation.type,
          revealHint: false,
          rule: evaluation.rule,
        });
        announce('Are you sure?', { listenAfter: true });
      }
    } else {
      setStrategyDecisions(current => current + 1);
      executeRequestedAction(actionType);
    }
  };

  handleActionRef.current = handleAction;

  const resolvePendingAction = (proceed) => {
    const action = pendingAction;
    setPendingAction(null);
    if (action.type === 'betSizing') {
      if (proceed) {
        deal(action.bets, { skipBetWarning: true });
      } else {
        setSpotBets(current => current.map((bet, index) => (
          index < numHands ? action.recommendedWager : bet
        )));
        announce(`Wagers corrected to ${action.recommendedWager} dollars per spot.`, { listenAfter: true });
      }
      return;
    }
    if (proceed) {
      executeRequestedAction(action.intended);
    } else {
      executeRequestedAction(action.optimal);
    }
  };

  const dismissPendingAction = () => {
    setPendingAction(null);
    setHintedAction(null);
  };

  const requestHint = () => {
    if (pendingAction?.type === 'play') {
      setHintedAction(pendingAction.optimal);
      setPendingAction(current => current ? { ...current, revealHint: true } : current);
      return;
    }

    const hand = getCurrentActiveHand();
    if (gameState !== 'playing' || !hand || !dealerHand[0]) {
      announce('Strategy advice is available during an active player hand.', { listenAfter: true });
      return;
    }
    const evaluation = getDetailedPlay(
      hand.cards,
      dealerHand[0],
      shoeRef.current.trueCount,
      {
        allowSurrender: rules.lateSurrender && canSurrenderHand(hand),
        rules,
        runningCount: shoeRef.current.visibleRunningCount,
      },
    );
    let recommendedAction = evaluation.action;
    if (recommendedAction === 'double' && hand.cards.length > 2) {
      recommendedAction = calculateTotal(hand.cards) >= 18 ? 'stand' : 'hit';
    }
    setHintedAction(recommendedAction);
    setStrategyDecisions(current => current + 1);
    setStrategyMistakes(current => current + 1);
    announce(
      `${evaluation.type} recommends ${recommendedAction}. The recommended button is highlighted. ${evaluation.rule}`,
      { listenAfter: true },
    );
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

  const getVoiceSummary = () => {
    if (pendingAction) {
      return pendingAction.revealHint
        ? `The recommended choice is ${pendingAction.optimal}.`
        : 'Are you sure? Strategy decision pending.';
    }

    if (gameState === 'betting') {
      const wagers = spotBets
        .slice(0, numHands)
        .map((bet, index) => `spot ${index + 1}, ${bet} dollars`)
        .join('; ');
      return `${numHands} ${numHands === 1 ? 'spot' : 'spots'}: ${wagers}.`;
    }

    if (gameState === 'evenMoney') {
      const offer = evenMoneyQueue[0];
      return `Spot ${offer?.spotIndex + 1} has blackjack. Even money decision pending.`;
    }

    if (gameState === 'insurance') {
      return 'Dealer shows an ace. Insurance decision pending.';
    }

    if (gameState === 'playing') {
      const hand = getCurrentActiveHand();
      return `Active spot ${activeSpotIndex + 1}${playerSpots[activeSpotIndex]?.subHands.length > 1 ? `, split hand ${activeSubHandIndex + 1}` : ''}, total ${getSpokenHandTotal(hand?.cards)}.`;
    }

    if (gameState === 'resolved') {
      const queuedWagers = spotBets
        .slice(0, numHands)
        .map((bet, index) => `spot ${index + 1}, ${bet} dollars`)
        .join('; ');
      return `${getRoundOutcomeSummary()}. Bankroll ${bankroll} dollars. Next wager: ${queuedWagers}.`;
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
      || bets.some(bet => !isValidTableWager(bet))
    ) {
      announce(
        `Please give one wager for each spot, between 25 and 10000 dollars in 25 dollar units.`,
        { listenAfter: true },
      );
      return;
    }

    updateSpotCount(spotCount);
    setSpotBets(current => current.map((bet, index) => bets[index] ?? bet));
    const summary = bets.map((bet, index) => `spot ${index + 1}, ${bet} dollars`).join('; ');
    announce(`${spotCount} ${spotCount === 1 ? 'spot' : 'spots'} set. ${summary}.`, { listenAfter: true });
  };

  const beginNextRound = () => {
    setGameState('betting');
  };

  // Table pace: sweep the cards automatically after payouts, like a live dealer.
  useEffect(() => {
    if (gameState !== 'resolved' || tablePace === 'manual') return undefined;
    const timer = window.setTimeout(() => setGameState('betting'), TABLE_PACE_MS[tablePace]);
    return () => window.clearTimeout(timer);
  }, [gameState, tablePace]);

  const resolveCountDrill = (guess) => {
    const drill = countDrill;
    setCountDrill(null);
    if (!drill) return;
    if (guess !== null && Number.isFinite(guess)) {
      const difference = Math.abs(guess - drill.actual);
      setCountDrillStats(current => ({
        attempts: current.attempts + 1,
        exact: current.exact + (difference === 0 ? 1 : 0),
      }));
      loggerRef.current.log(
        'COUNT_DRILL',
        `Shuffle count check: called ${guess}, actual ${drill.actual} (off by ${difference}).`,
        { difference, guess, runningCount: drill.actual, trueCount: drill.trueCount },
      );
      setProfile(current => recordDrill(current, difference));
    }
    deal(drill.bets, { skipBetWarning: true, skipCountDrill: true });
  };

  // Lifetime profile: fold session deltas in as they happen.
  useEffect(() => {
    const previous = profileDeltaRef.current;
    if (previous.decisions === null) {
      profileDeltaRef.current = { decisions: strategyDecisions, hands: sessionHands.length, mistakes: strategyMistakes };
      return;
    }
    const decisionDelta = strategyDecisions - previous.decisions;
    const mistakeDelta = strategyMistakes - previous.mistakes;
    const newHands = sessionHands.slice(previous.hands);
    profileDeltaRef.current = { decisions: strategyDecisions, hands: sessionHands.length, mistakes: strategyMistakes };
    if (decisionDelta > 0 || newHands.length > 0) {
      setProfile((current) => {
        let next = current;
        if (decisionDelta > 0) next = recordDecisions(next, { decisions: decisionDelta, mistakes: Math.max(0, mistakeDelta) });
        if (newHands.length > 0) {
          next = recordHands(next, newHands);
          if (aiSeatCount === 4 && tablePace === 'pro') next = recordFullTableCasinoRound(next);
        }
        return next;
      });
    }
  }, [strategyDecisions, strategyMistakes, sessionHands, aiSeatCount, tablePace]);

  useEffect(() => {
    saveProfile(profile);
  }, [profile]);

  const resetSession = () => {
    if (!['betting', 'resolved'].includes(gameState)) return;
    setProfile(current => startNewSession(recordSessionPnl(current, sessionPnl)));
    setBankroll(STARTING_BANKROLL);
    setTotalBuyIns(0);
    setSessionHands([]);
    setStrategyDecisions(0);
    setStrategyMistakes(0);
    setCountDrillStats({ attempts: 0, exact: 0 });
    setPlayerSpots([]);
    setDealerHand([]);
    syncAiPlayers([]);
    shoeRef.current.buildAndShuffle();
    loggerRef.current = new GameLogger();
    setGameState('betting');
    setShowSettings(false);
    announce('New session. Bankroll reset to one thousand dollars, fresh shoe.', { listenAfter: true });
  };

  // Persist the session so a refresh keeps the bankroll, history, and settings.
  // Mid-round wagers are folded back into the saved bankroll since hands
  // themselves are not restored.
  useEffect(() => {
    saveSessionState({
      aiSeatCount,
      bankroll: bankroll + getUnresolvedHandWager(playerSpots),
      betSpread,
      rules,
      countDrillEnabled,
      countDrillStats,
      numHands,
      reloadAmount,
      sessionHands,
      showStrategyPopups,
      spotBets,
      strategyDecisions,
      strategyMistakes,
      tablePace,
      totalBuyIns,
      warnBetSizing,
      warnStrategy,
    });
  }, [
    aiSeatCount, bankroll, betSpread, countDrillEnabled, countDrillStats, numHands, playerSpots,
    reloadAmount, rules, sessionHands, showStrategyPopups, spotBets,
    strategyDecisions, strategyMistakes, tablePace, totalBuyIns, warnBetSizing, warnStrategy,
  ]);

  const triggerCelebration = () => {
    setCelebrationKey(current => current + 1);
    playSound('win');
  };

  const triggerSickReaction = () => {
    setSickReactionKey(current => current + 1);
    playSound('loss');
  };

  const toggleFullscreen = async (enabled = !isFullscreen) => {
    try {
      if (enabled && !document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else if (!enabled && document.fullscreenElement) {
        await document.exitFullscreen();
      }
    } catch {
      announce('Fullscreen was blocked by the browser.', {
        listenAfter: true,
      });
    }
  };

  const stackBets = (dealImmediately = false) => {
    if (!['betting', 'resolved'].includes(gameState)) {
      announce('Stack it is available between rounds.', { listenAfter: true });
      return;
    }

    const activeBets = spotBets.slice(0, numHands);
    if (activeBets.some(bet => bet * 2 > 10000)) {
      announce('The table maximum is 10000 dollars per spot.', { listenAfter: true });
      return;
    }

    const doubledBets = activeBets.map(bet => bet * 2);
    setSpotBets(current => current.map((bet, index) => doubledBets[index] ?? bet));
    const summary = doubledBets
      .map((bet, index) => `spot ${index + 1}, ${bet} dollars`)
      .join('; ');
    if (dealImmediately) {
      deal(doubledBets);
    } else {
      announce(`Wagers doubled. ${summary}.`, { listenAfter: true });
    }
  };

  const handleVoiceCommand = (command) => {
    if (command?.type === 'unknown' || !command) {
      announce(`I did not recognize that command. ${getVoiceSummary()}`, { listenAfter: true });
      return;
    }

    if (command.type === 'help') {
      announce(
        'You can set one or two spots with separate wagers, deal, hit, stand, double, split, surrender, buy or decline insurance, take or decline even money, say run it, next, stack it, bang, toggle the count, dealer voice, or study guide, reload funds, or ask for a strategy tip, bankroll, or status.',
        { listenAfter: true },
      );
      return;
    }
    if (command.type === 'status') {
      announce(getVoiceSummary(), { listenAfter: true });
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
      announce(`Bankroll is ${bankroll} dollars.`, { listenAfter: true });
      return;
    }
    if (command.type === 'tip') {
      requestHint();
      return;
    }
    if (command.type === 'count') {
      setShowCount(command.enabled);
      if (command.enabled) {
        announce(
          getSpokenCountSummary(
            shoeRef.current.visibleRunningCount,
            shoeRef.current.trueCount,
            shoeRef.current.decksRemaining,
          ),
          { listenAfter: true },
        );
      } else {
        announce('Count display off.', { listenAfter: true });
      }
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
    if (command.type === 'celebrate') {
      triggerCelebration();
      return;
    }
    if (command.type === 'sickReaction') {
      triggerSickReaction();
      return;
    }
    if (command.type === 'countToggle') {
      setShowCount(current => !current);
      return;
    } else if (command.type === 'fullscreen') {
      toggleFullscreen(command.enabled);
      return;
    }
    if (command.type === 'stackBet') {
      stackBets();
      return;
    }
    if (command.type === 'stackAndRun') {
      stackBets(true);
      return;
    }
    if (command.type === 'runIt') {
      if (['betting', 'resolved'].includes(gameState)) deal();
      else announce('Run it is available between rounds.', { listenAfter: true });
      return;
    }

    if (gameState === 'resolved' && command.type === 'configureBets') {
      configureVoiceBets(command);
      return;
    }

    if (pendingAction) {
      if (command.type === 'proceed') resolvePendingAction(true);
      else if (command.type === 'correct') resolvePendingAction(false);
      else if (command.type === 'cancel') dismissPendingAction();
      else announce(getVoiceSummary(), { listenAfter: true });
      return;
    }

    if (gameState === 'betting') {
      if (command.type === 'configureBets') configureVoiceBets(command);
      else if (command.type === 'setSpots') {
        updateSpotCount(command.spotCount);
        announce(
          `${command.spotCount} ${command.spotCount === 1 ? 'spot' : 'spots'} selected.`,
          { listenAfter: true },
        );
      } else if (command.type === 'deal') deal();
      else announce(getVoiceSummary(), { listenAfter: true });
      return;
    }

    if (gameState === 'playing') {
      if (command.type !== 'action') {
        announce(getVoiceSummary(), { listenAfter: true });
        return;
      }
      if (
        ['double', 'doubleFaceDown'].includes(command.action)
        && getCurrentActiveHand()?.cards.length !== 2
      ) {
        announce('Double is not available after a hit.', { listenAfter: true });
      } else if (command.action === 'split' && !canSplitCurrent()) {
        announce('Split is not available for this hand.', { listenAfter: true });
      } else if (command.action === 'surrender' && !canSurrenderHand(getCurrentActiveHand())) {
        announce('Late surrender is only available on the original two-card hand.', {
          listenAfter: true,
        });
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

    announce(getVoiceSummary(), { listenAfter: true });
  };

  voiceCommandRef.current = handleVoiceCommand;

  const handleVoiceToggle = async () => {
    const enabling = !voiceInputEnabled;
    const enabled = await toggleVoiceInput();
    if (enabling && enabled) {
      playSound('chips');
      announce(
        `Voice mode on. ${getVoiceSummary()}`,
        { listenAfter: true },
      );
    }
  };

  keyboardActionRef.current = (event) => {
    if (
      event.defaultPrevented
      || event.repeat
      || event.altKey
      || event.ctrlKey
      || event.metaKey
      || event.target instanceof HTMLInputElement
      || event.target instanceof HTMLSelectElement
      || event.target instanceof HTMLTextAreaElement
      || event.target?.isContentEditable
    ) return;

    const command = getKeyboardCommand(event.key, gameState);
    if (!command) return;
    event.preventDefault();

    if (command.type === 'countToggle') {
      setShowCount(current => !current);
    } else if (command.type === 'fullscreen') {
      toggleFullscreen();
    } else if (command.type === 'voiceMode') {
      handleVoiceToggle();
    } else if (command.type === 'action') {
      if (command.action === 'double' && getCurrentActiveHand()?.cards.length !== 2) return;
      if (command.action === 'split' && !canSplitCurrent()) return;
      if (command.action === 'surrender' && !canSurrenderHand(getCurrentActiveHand())) return;
      handleAction(command.action);
    } else if (command.type === 'insurance') {
      executeInsurance(command.buy);
    } else if (command.type === 'evenMoney') {
      executeEvenMoney(command.accept);
    }
  };

  useEffect(() => {
    const handleKeyDown = event => keyboardActionRef.current?.(event);
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const renderChipStack = (amount, outcome, small = false, onChipClick = null) => {
    let remaining = Math.round(amount * 2) / 2;
    const chips = [];
    [1000, 500, 100, 25, 5, 2.5].forEach(d => {
      while (remaining >= d - 1e-9) { chips.push(d); remaining -= d; }
    });

    let glowClass = '';
    if (outcome === 'win') glowClass = 'chip-glow-green';
    else if (outcome === 'loss') glowClass = 'chip-glow-red';

    const chipSize = small ? 26 : 36;
    const chipLift = small ? 4 : 5;
    const stackHeight = chipSize + Math.max(0, chips.length - 1) * chipLift;

    return (
      <div className={`chip-stack-container ${glowClass}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', transition: 'all 0.4s ease' }}>
        <div style={{ position: 'relative', width: `${chipSize}px`, height: `${stackHeight}px` }}>
          {chips.map((c, idx) => (
            <div
              className={`chip-token ${onChipClick ? 'is-removable' : ''}`}
              key={idx}
              role={onChipClick ? 'button' : undefined}
              tabIndex={onChipClick ? 0 : undefined}
              aria-label={onChipClick ? `Remove $${c} chip from bet` : undefined}
              onClick={onChipClick ? () => onChipClick(c) : undefined}
              onKeyDown={onChipClick ? (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onChipClick(c); } } : undefined}
              style={{
                position: 'absolute', left: 0, bottom: `${idx * chipLift}px`,
                width: `${chipSize}px`, height: `${chipSize}px`, borderRadius: '50%', background: getChipColor(c),
                border: '2px dashed #fff', boxShadow: '0 3px 5px rgba(0,0,0,0.45), inset 0 -2px 3px rgba(0,0,0,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: small ? '0.56rem' : '0.7rem', fontWeight: 'bold', color: '#fff',
                textShadow: '0 1px 1px rgba(0,0,0,0.6)',
                zIndex: idx, animationDelay: `${idx * 35}ms`, cursor: onChipClick ? 'pointer' : 'default',
              }}
            >${c >= 1000 ? `${c / 1000}K` : c}</div>
          ))}
        </div>
        <div style={{ fontSize: small ? '0.62rem' : '0.8rem', fontWeight: '600', color: '#f1c40f' }}>${amount}</div>
      </div>
    );
  };

  const renderAiSeat = (seat) => {
    const total = calculateTotal(seat.cards);
    return (
      <div
        key={seat.name}
        className={`ai-seat ${seat.status === 'acting' ? 'is-acting' : ''} ${seat.outcome ? `is-${seat.outcome}` : ''}`}
      >
        <span className="ai-name">{seat.name}</span>
        <div className="ai-cards">
          {seat.cards.map((card, cardIndex) => (
            <PlayingCard key={cardIndex} card={card} compact delay={getDealDelay(`seat:${seat.name}`, cardIndex)} />
          ))}
        </div>
        <span className={`ai-total ${total > 21 ? 'is-bust' : ''}`}>
          {total > 21 ? 'Bust' : total}
          {seat.outcome && <b>{seat.outcome}</b>}
        </span>
        <div className="bet-circle is-small">{renderChipStack(seat.bet, seat.outcome, true)}</div>
      </div>
    );
  };

  const renderIdleSeat = (seat) => (
    <div key={seat.name} className="ai-seat is-idle">
      <span className="ai-name">{seat.name}</span>
      <div className="bet-circle is-small is-empty" />
    </div>
  );

  const accuracyRate = strategyDecisions > 0
    ? Math.round(((strategyDecisions - strategyMistakes) / strategyDecisions) * 100)
    : 0;
  const hasOpenRound = ['playing', 'insurance', 'evenMoney', 'dealerRevealing', 'aiPlaying', 'dealing'].includes(gameState);
  const unresolvedHandWager = hasOpenRound ? getUnresolvedHandWager(playerSpots) : 0;
  const insuranceStillAtRisk = gameState === 'insurance'
    || (
      gameState === 'dealerRevealing'
      && dealerHand.length === 2
      && calculateTotal(dealerHand) === 21
    );
  const unresolvedInsuranceWager = insuranceStillAtRisk
    ? insuranceBets.reduce((sum, bet) => sum + bet, 0)
    : 0;
  const sessionPnl = calculateRealizedPnl({
    bankroll,
    buyIns: totalBuyIns,
    unresolvedWager: unresolvedHandWager + unresolvedInsuranceWager,
  });

  useEffect(() => {
    if (sessionPnl > 0) setProfile(current => recordSessionPnl(current, sessionPnl));
  }, [sessionPnl]);

  return (
    <main className="app-shell" style={{
      position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', 
      background: 'radial-gradient(circle at center, #0f4c20 0%, #072a12 70%, #031408 100%)', 
      color: '#fff', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', 
      display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '1.4rem 2.25rem 1.5rem', boxSizing: 'border-box',
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
        @keyframes confettiFall {
          0% { opacity: 0; transform: translate3d(0, -16vh, 0) rotate(0deg) scale(0.55); }
          7% { opacity: 1; }
          72% { opacity: 1; }
          100% { opacity: 0; transform: translate3d(var(--confetti-drift), 112vh, 0) rotate(var(--confetti-rotation)) scale(var(--particle-scale)); }
        }
        @keyframes sickReactionFall {
          0% { opacity: 0; transform: translate3d(0, -18vh, 0) rotate(-20deg) scale(0.45); }
          8% { opacity: 1; }
          58% { opacity: 1; transform: translate3d(var(--sick-drift), 58vh, 0) rotate(16deg) scale(1.18); }
          84% { opacity: 1; }
          100% { opacity: 0; transform: translate3d(var(--sick-drift), 116vh, 0) rotate(-14deg) scale(0.88); }
        }
        @keyframes sickScreenPulse {
          0%, 100% { opacity: 0; }
          18% { opacity: 0.68; }
          45% { opacity: 0.2; }
          67% { opacity: 0.52; }
        }
        @keyframes sickGiantPulse {
          0%, 100% { opacity: 0; transform: translate(-50%, -50%) rotate(-8deg) scale(0.45); }
          24% { opacity: 0.96; transform: translate(-50%, -50%) rotate(7deg) scale(1.08); }
          62% { opacity: 0.72; transform: translate(-50%, -50%) rotate(-4deg) scale(0.92); }
        }
      `}</style>

      {celebrationKey > 0 && (
        <div key={celebrationKey} className="confetti-burst" aria-hidden="true">
          {CONFETTI_PARTICLES.map((particle, index) => (
            <i
              key={index}
              style={{
                '--confetti-drift': particle.drift,
                '--confetti-rotation': particle.rotation,
                '--particle-scale': particle.scale,
                animationDelay: particle.delay,
                backgroundColor: particle.color,
                left: particle.left,
              }}
            />
          ))}
        </div>
      )}

      {sickReactionKey > 0 && (
        <div key={sickReactionKey} className="sick-reaction" aria-hidden="true">
          {SICK_REACTION_PARTICLES.map((particle, index) => (
            <i
              key={index}
              style={{
                '--sick-drift': particle.drift,
                animationDelay: particle.delay,
                fontSize: particle.size,
                left: particle.left,
              }}
            >
              {particle.emoji}
            </i>
          ))}
        </div>
      )}

      {showCheatSheet && (
        <CheatSheet
          onClose={() => setShowCheatSheet(false)}
          rules={rules}
          betSpread={betSpread}
          onBetSpreadChange={setBetSpread}
          bankroll={bankroll}
          aiSeatCount={aiSeatCount}
        />
      )}

      {showSettings && (
        <SettingsDrawer
          onClose={() => setShowSettings(false)}
          warnStrategy={warnStrategy}
          onWarnStrategyChange={setWarnStrategy}
          warnBetSizing={warnBetSizing}
          onWarnBetSizingChange={setWarnBetSizing}
          showStrategyPopups={showStrategyPopups}
          onStrategyPopupsChange={setShowStrategyPopups}
          soundEnabled={soundEnabled}
          onSoundChange={setSoundEnabled}
          speechEnabled={speechEnabled}
          onSpeechChange={setSpeechEnabled}
          kokoroVoices={kokoroVoices}
          selectedVoiceName={selectedVoiceName}
          onVoiceChange={setSelectedVoiceName}
          voiceModelStatus={voiceModelStatus}
          voiceModelProgress={voiceModelProgress}
          onPreviewVoice={() => announce('Betting is open.')}
          onExportLog={() => loggerRef.current.downloadCSV()}
          tablePace={tablePace}
          onTablePaceChange={setTablePace}
          countDrillEnabled={countDrillEnabled}
          onCountDrillChange={setCountDrillEnabled}
          drillStats={countDrillStats}
          aiSeatCount={aiSeatCount}
          onAiSeatCountChange={setAiSeatCount}
          rules={rules}
          onRulesChange={changes => setRules(current => normalizeRules({ ...current, ...changes }))}
          rulesLocked={!['betting', 'resolved'].includes(gameState)}
          profile={profile}
          sessionStatus={{
            accuracyRate,
            bankroll,
            buyIns: totalBuyIns,
            hands: sessionHands.length,
            pnl: sessionPnl,
          }}
          onResetSession={resetSession}
        />
      )}

      {countDrill && (
        <CountDrillModal
          actualCount={countDrill.actual}
          trueCount={countDrill.trueCount}
          decksRemaining={countDrill.decksRemaining}
          onResolve={resolveCountDrill}
        />
      )}

      <PopupModal
        isOpen={!!pendingAction}
        title={pendingAction?.type === 'betSizing' ? 'Bet sizing check' : 'Are you sure?'}
        category={pendingAction?.category}
        optimalAction={pendingAction?.optimal}
        rule={pendingAction?.rule}
        revealHint={pendingAction?.revealHint}
        onBack={dismissPendingAction}
        onCorrect={() => resolvePendingAction(false)}
        onHint={requestHint}
        onProceed={() => resolvePendingAction(true)}
      />

      <div className="sr-only" aria-live="assertive" aria-atomic="true">{lastAnnouncement}</div>

      {/* HEADER BAR */}
      <div className="header-bar">
        <div className="brand-lockup">
          <img
            className="brand-mark"
            src={`${import.meta.env.BASE_URL}brand/count-lab-logo.png`}
            alt=""
          />
          <div className="brand-copy">
            <h1>Count Lab</h1>
            <span className="eyebrow">Blackjack training</span>
          </div>
        </div>
        <BankrollScore
          value={bankroll}
          sessionPnl={sessionPnl}
          accuracyRate={accuracyRate}
          reloadOpen={showReload}
          onToggleReload={() => setShowReload(current => !current)}
          sessionOpen={showSession}
          onToggleSession={() => setShowSession(current => !current)}
        />
        <div className="header-actions">
          <button
            className={`topbar-button ${showCount ? 'is-on' : ''}`}
            onClick={() => setShowCount(!showCount)}
            aria-pressed={showCount}
          >
            <svg className="header-action-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M2.5 12S6 5.6 12 5.6 21.5 12 21.5 12 18 18.4 12 18.4 2.5 12 2.5 12Z" />
              <circle cx="12" cy="12" r="2.7" />
            </svg>
            <span>{showCount ? 'Hide count' : 'Count'}</span>
          </button>
          <button className="topbar-button is-featured" onClick={() => setShowCheatSheet(true)}>
            Study guide
          </button>
          <button
            className={`topbar-button header-icon-button voice-toggle ${voiceInputEnabled ? 'is-on' : ''} ${['starting', 'listening', 'hearing', 'processing'].includes(voiceStatus) ? 'is-listening' : ''}`}
            onClick={handleVoiceToggle}
            disabled={!voiceSupported}
            aria-pressed={voiceInputEnabled}
            aria-label={voiceInputEnabled ? 'Turn voice commands off' : 'Turn voice commands on'}
            title={voiceSupported
              ? voiceInputEnabled ? 'Voice commands on' : 'Voice commands'
              : 'Voice commands unavailable'}
          >
            <svg className="header-action-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 3a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3Z" />
              <path d="M6.2 11.2a5.8 5.8 0 0 0 11.6 0M12 17.4V21m-3.2 0h6.4" />
            </svg>
            <span className="sr-only">
              {voiceInputEnabled ? 'Voice commands on' : 'Voice commands off'}
            </span>
          </button>
          <button
            className="topbar-button header-icon-button"
            onClick={() => setShowSettings(true)}
            aria-haspopup="dialog"
            aria-label="Open settings"
            title="Settings"
          >
            <svg className="header-action-icon is-gear" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M10.3 2.5h3.4l.5 2.6c.6.2 1.2.5 1.7 .9l2.5-.9 1.7 2.9-2 1.7c.1.6.1 1.2 0 1.8l2 1.7-1.7 2.9-2.5-.9c-.5.4-1.1.7-1.7.9l-.5 2.6h-3.4l-.5-2.6c-.6-.2-1.2-.5-1.7-.9l-2.5.9-1.7-2.9 2-1.7a6.6 6.6 0 0 1 0-1.8l-2-1.7 1.7-2.9 2.5.9c.5-.4 1.1-.7 1.7-.9l.5-2.6Z" />
              <circle cx="12" cy="12" r="2.6" />
            </svg>
            <span className="sr-only">Settings</span>
          </button>
        </div>
      </div>

      {voiceInputEnabled && (
        <div className="floating-voice-mode">
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
        </div>
      )}

      {(showReload || showSession) && (
        <div
          className="popover-scrim"
          onClick={() => { setShowReload(false); setShowSession(false); }}
          aria-hidden="true"
        />
      )}
      {(showReload || showSession) && (
        <section className="session-panel" aria-label="Session analytics and bankroll reload">
          {showSession && <SessionChart hands={sessionHands} />}
          {showReload && (
          <div className="reload-panel">
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
          </div>
          )}
        </section>
      )}

      {showCount && (
        <div className="count-panel" aria-live="polite">
          <div><span>Running count</span><strong>{shoeRef.current.visibleRunningCount > 0 ? '+' : ''}{shoeRef.current.visibleRunningCount}</strong></div>
          <div><span>True count</span><strong>{shoeRef.current.trueCount > 0 ? '+' : ''}{shoeRef.current.trueCount}</strong></div>
          <div><span>Decks left</span><strong>{shoeRef.current.decksRemaining.toFixed(1)}</strong></div>
        </div>
      )}

      {/* GAME BOARD TABLE */}
      <div className={`game-board is-${gameState}`}>
        <ShoeTray
          dealtFraction={1 - shoeRef.current.cards.length / shoeRef.current.totalCards}
          decks={shoeRef.current.decks}
        />
        <DealerShoe
          remainingFraction={shoeRef.current.cards.length / shoeRef.current.totalCards}
          cutFraction={shoeRef.current.cutCardPosition / shoeRef.current.totalCards}
          decksRemaining={shoeRef.current.decksRemaining}
        />
        <ChipRack
          amount={gameState === 'betting'
            ? Math.max(0, bankroll - spotBets.slice(0, numHands).reduce((sum, bet) => sum + bet, 0))
            : bankroll}
          canBet={gameState === 'betting'}
          onDropChip={addChipToBet}
          onTapChip={denomination => addChipToBet(denomination, 0)}
        />
        <svg className="table-rule-arc" viewBox="0 0 900 170" aria-hidden="true">
          <defs>
            <path id="table-rule-path" d="M 55 150 Q 450 -90 845 150" />
          </defs>
          <use href="#table-rule-path" className="table-rule-line" />
          <text className="table-rule-copy table-rule-copy-left" dy="-13">
            <textPath href="#table-rule-path" startOffset="19%" textAnchor="middle">INSURANCE PAYS 2 TO 1</textPath>
          </text>
          <text className="table-rule-copy table-rule-copy-center" dy="-23">
            <textPath href="#table-rule-path" startOffset="50%" textAnchor="middle">BLACKJACK PAYS {rules.blackjackPayout === 1.2 ? '6 TO 5' : '3 TO 2'}</textPath>
          </text>
          <text className="table-rule-copy table-rule-copy-right" dy="-13">
            <textPath href="#table-rule-path" startOffset="81%" textAnchor="middle">{rules.dealerHitsSoft17 ? 'DEALER MUST HIT SOFT 17' : 'DEALER STANDS ON ALL 17S'}</textPath>
          </text>
        </svg>
        {gameState === 'shuffling' ? (
          <>
            <div className="hand-zone dealer-zone shuffle-layout-spacer" aria-hidden="true">
              <div className="zone-label"><span>Dealer</span><strong>—</strong></div>
              <div className="card-row dealer-cards">
                <div className="shoe-placeholder"><span>♠</span><small>SHOE READY</small></div>
              </div>
            </div>
            <div className="hand-zone player-zone shuffle-layout-spacer" aria-hidden="true">
              <div className="zone-label"><span>Your hands</span><strong>—</strong></div>
              <div className="player-spots" style={{ display: 'flex', gap: '3rem', justifyContent: 'center', minHeight: '130px' }}>
                <div className="betting-prompt">
                  <span>PLACE YOUR WAGER</span>
                  <small>Choose separate wagers and the number of spots below</small>
                </div>
              </div>
            </div>
            <div className="shuffle-state" role="status" aria-live="polite">
              <div className="shuffle-cards" aria-hidden="true">
                {Array.from({ length: 12 }, (_, cardIndex) => (
                  <i
                    key={cardIndex}
                    className={cardIndex % 2 === 0 ? 'is-left' : 'is-right'}
                    style={{ '--shuffle-index': Math.floor(cardIndex / 2) }}
                  >
                    <span>♠</span>
                  </i>
                ))}
              </div>
              <div className="shuffle-copy">
                <strong>Reshuffling shoe</strong>
                <span>Washing and cutting six decks</span>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* DEALER AREA */}
            <div className="hand-zone dealer-zone">
              <div className="zone-label">
                <span>Dealer</span>
                <strong>
                  {['playing', 'insurance', 'evenMoney', 'aiPlaying', 'dealing'].includes(gameState)
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
                    const hidden = ['playing', 'insurance', 'evenMoney', 'aiPlaying', 'dealing'].includes(gameState) && i === 1;
                    return <PlayingCard key={i} card={card} hidden={hidden} delay={getDealDelay('dealer', i)} />;
                  })
                )}
              </div>
            </div>

            {/* PLAYER SPOTS */}
            <div className="hand-zone player-zone">
              <div className="zone-label"><span>Your hands</span><strong>{playerSpots.reduce((sum, spot) => sum + spot.subHands.length, 0) || '—'}</strong></div>
              <div className="player-spots">
                {gameState === 'betting' ? (
                  <div className="table-seats is-betting">
                    {getAiSeatsForCount(aiSeatCount).filter(seat => seat.position === 'post').reverse().map(renderIdleSeat)}
                    {Array.from({ length: numHands }, (_, spotIndex) => (
                      <div className="user-seat" key={spotIndex}>
                        <div className="bet-circle is-live" data-bet-target={spotIndex}>
                          {spotBets[spotIndex] > 0
                            ? renderChipStack(spotBets[spotIndex], null, false, denomination => removeChipFromBet(denomination, spotIndex))
                            : <span className="bet-circle-hint">BET</span>}
                        </div>
                        <span className="ai-name is-you">You{numHands > 1 ? ` · ${spotIndex + 1}` : ''}</span>
                      </div>
                    ))}
                    {getAiSeatsForCount(aiSeatCount).filter(seat => seat.position === 'pre').reverse().map(renderIdleSeat)}
                  </div>
                ) : (
                  <div className="table-seats">
                    {aiPlayers.filter(seat => seat.position === 'post').reverse().map(renderAiSeat)}
                    {playerSpots.map((spot, sIdx) => (
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
                                  {hand.cards.map((card, cIdx) => {
                                    const isDoubleCard = hand.isDoubled && cIdx === hand.cards.length - 1;
                                    return (
                                      <PlayingCard
                                        key={cIdx}
                                        card={card}
                                        compact
                                        delay={hand.isSplitHand ? cIdx * 90 : getDealDelay(`spot:${sIdx}`, cIdx)}
                                        hidden={isDoubleCard && hand.doubleCardFaceDown}
                                        peel={isDoubleCard && hand.doubleCardPeeling}
                                      />
                                    );
                                  })}
                              </div>
                              <div className="hand-total">
                                <span>
                                  {isNaturalBJ
                                    ? 'Blackjack'
                                    : hand.doubleCardFaceDown ? 'Double card down' : 'Total'}
                                </span>
                                <strong>{hand.doubleCardFaceDown ? '—' : calculateTotal(hand.cards)}</strong>
                                </div>
                              <div className="bet-circle">
                                {renderChipStack(
                                  hand.outcome === 'surrender' ? hand.bet / 2 : hand.bet,
                                  hand.outcome,
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                    {aiPlayers.filter(seat => seat.position === 'pre').reverse().map(renderAiSeat)}
                  </div>
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
          onSurrender={() => handleAction('surrender')}
          canDouble={getCurrentActiveHand()?.cards.length === 2 && (rules.doubleAfterSplit || !getCurrentActiveHand()?.isSplitHand)}
          canSplit={canSplitCurrent()}
          canSurrender={rules.lateSurrender && canSurrenderHand(getCurrentActiveHand())}
          canResplit={(playerSpots[activeSpotIndex]?.subHands.length || 0) > 1}
          hintedAction={hintedAction}
          onHint={requestHint}
          onInsurance={executeInsurance}
          onNextRound={beginNextRound}
        />
      )}
    </main>
  );
}
