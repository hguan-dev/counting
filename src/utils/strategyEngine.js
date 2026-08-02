export const calculateTotal = (cards) => {
  if (!cards || !Array.isArray(cards)) return 0;
  let sum = 0;
  let aces = 0;
  cards.forEach(c => {
    let val = c.numericValue !== undefined ? c.numericValue : (['J', 'Q', 'K'].includes(c.value) ? 10 : c.value === 'A' ? 11 : parseInt(c.value, 10) || 0);
    sum += val;
    if (c.value === 'A') aces += 1;
  });
  while (sum > 21 && aces > 0) {
    sum -= 10;
    aces -= 1;
  }
  return sum;
};

export const isSoftHand = (cards) => {
  if (!cards || !Array.isArray(cards)) return false;
  let hardTotal = 0;
  let aces = 0;
  cards.forEach((card) => {
    if (card.value === 'A') {
      hardTotal += 1;
      aces += 1;
    } else if (['J', 'Q', 'K'].includes(card.value)) {
      hardTotal += 10;
    } else {
      hardTotal += Number(card.numericValue ?? card.value) || 0;
    }
  });
  return aces > 0 && hardTotal + 10 <= 21;
};

const getNumericValue = (card) => (
  card.numericValue !== undefined
    ? card.numericValue
    : (['J', 'Q', 'K'].includes(card.value) ? 10 : card.value === 'A' ? 11 : Number(card.value))
);

export const getDetailedPlay = (
  pCards,
  dUpCard,
  tc,
  { allowSurrender = true, runningCount = null } = {},
) => {
  const dValue = getNumericValue(dUpCard);
  const d = dValue === 11 ? 11 : dValue;
  const p = calculateTotal(pCards);
  const isPair = pCards.length === 2 && getNumericValue(pCards[0]) === getNumericValue(pCards[1]);
  const isSoft = isSoftHand(pCards);
  const isPairOfEights = isPair && getNumericValue(pCards[0]) === 8;
  const isPairOfTens = isPair && getNumericValue(pCards[0]) === 10;
  const zeroIndexCount = Number.isFinite(runningCount) ? runningCount : tc;

  const deviation = getDeviationPlay({
    allowSurrender,
    dealer: d,
    isPair,
    isPairOfTens,
    isSoft,
    total: p,
    trueCount: tc,
    zeroIndexCount,
  });
  if (deviation) return deviation;

  // Six-deck H17 late surrender after full count-index overrides.
  if (allowSurrender && pCards.length === 2 && !isSoft) {
    if (isPairOfEights && d === 11) {
      return { action: 'surrender', type: 'Basic Strategy', rule: 'Surrender 8s against an Ace in this six-deck H17 game.' };
    }
    if (!isPairOfEights && p === 16 && d >= 9) {
      return { action: 'surrender', type: 'Basic Strategy', rule: 'Surrender hard 16 against 9, 10, or Ace.' };
    }
    if (p === 17 && d === 11) {
      return { action: 'surrender', type: 'Basic Strategy', rule: 'Surrender hard 17 against an Ace when the dealer hits soft 17.' };
    }
    if (p === 15 && d === 10 && zeroIndexCount >= 0) {
      return { action: 'surrender', type: 'H17 Surrender Index', rule: 'Surrender hard 15 vs 10 at a running count of 0 or higher.' };
    }
  }

  // Pairs Strategy
  if (isPair) {
    const v = getNumericValue(pCards[0]);
    if (v === 11 || v === 8) return { action: 'split', type: 'Basic Strategy', rule: 'Always split Aces and 8s.' };
    if (v === 10) return { action: 'stand', type: 'Basic Strategy', rule: 'Never split 20.' };
    if (v === 9) return { action: (d === 7 || d === 10 || d === 11) ? 'stand' : 'split', type: 'Basic Strategy', rule: 'Split 9s except vs 7, 10, Ace.' };
    if (v === 7) return { action: d <= 7 ? 'split' : 'hit', type: 'Basic Strategy', rule: 'Split 7s vs dealer 2-7.' };
    if (v === 6) return { action: d <= 6 ? 'split' : 'hit', type: 'Basic Strategy', rule: 'Split 6s vs dealer 2-6.' };
    if (v === 5) return { action: d <= 9 ? 'double' : 'hit', type: 'Basic Strategy', rule: 'Double 5s like hard 10.' };
    if (v === 4) return { action: (d === 5 || d === 6) ? 'split' : 'hit', type: 'Basic Strategy', rule: 'Split 4s vs 5-6.' };
    if (v === 3 || v === 2) return { action: d <= 7 ? 'split' : 'hit', type: 'Basic Strategy', rule: 'Split 2s/3s vs dealer 2-7.' };
  }

  // Soft Totals Strategy
  if (isSoft) {
    if (p >= 20) return { action: 'stand', type: 'Basic Strategy', rule: 'Always stand on soft 20+.' };
    if (p === 19) return { action: d === 6 ? 'double' : 'stand', type: 'Basic Strategy', rule: 'Double soft 19 vs 6 in this H17 game; otherwise stand.' };
    if (p === 18) return { action: (d >= 2 && d <= 6) ? 'double' : (d <= 8 ? 'stand' : 'hit'), type: 'Basic Strategy', rule: 'Double soft 18 vs 2-6, stand on 7-8, and hit vs 9-Ace.' };
    if (p === 17) return { action: (d >= 3 && d <= 6) ? 'double' : 'hit', type: 'Basic Strategy', rule: 'Double soft 17 vs 3-6, otherwise hit.' };
    if (p >= 15) return { action: (d >= 4 && d <= 6) ? 'double' : 'hit', type: 'Basic Strategy', rule: 'Double soft 15/16 vs 4-6.' };
    if (p >= 13) return { action: (d >= 5 && d <= 6) ? 'double' : 'hit', type: 'Basic Strategy', rule: 'Double soft 13/14 vs 5-6.' };
    return { action: 'hit', type: 'Basic Strategy', rule: 'Always hit soft totals 13 and under.' };
  }

  // Hard Totals Strategy
  if (p >= 17) return { action: 'stand', type: 'Basic Strategy', rule: 'Always stand on hard 17+.' };
  if (p >= 13 && d <= 6) return { action: 'stand', type: 'Basic Strategy', rule: 'Stand on hard 13-16 against dealer bust card (2-6).' };
  if (p === 12 && d >= 4 && d <= 6) return { action: 'stand', type: 'Basic Strategy', rule: 'Stand on 12 vs 4-6.' };
  if (p === 11) return { action: 'double', type: 'Basic Strategy', rule: 'Always double down on 11.' };
  if (p === 10 && d <= 9) return { action: 'double', type: 'Basic Strategy', rule: 'Double down on 10 vs 2-9.' };
  if (p === 9 && d >= 3 && d <= 6) return { action: 'double', type: 'Basic Strategy', rule: 'Double down on 9 vs 3-6.' };

  return { action: 'hit', type: 'Basic Strategy', rule: 'Hit stiff totals against strong dealer upcards.' };
};
import { getDeviationPlay } from './deviations';
