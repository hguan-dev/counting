import { getDeviationPlay } from './deviations';

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

const basic = (action, rule) => ({ action, rule, type: 'Basic Strategy' });

/**
 * Multi-deck basic strategy with count-index deviations layered on top.
 *
 * `rules` shapes the chart: dealerHitsSoft17 (H17 vs S17), doubleAfterSplit
 * (DAS), and lateSurrender. `allowSurrender` additionally gates surrender for
 * the specific hand (e.g. it is no longer a two-card hand). Pass
 * `ignoreDeviations` to get pure basic strategy regardless of the count.
 */
export const getDetailedPlay = (
  pCards,
  dUpCard,
  tc,
  {
    allowSurrender = true,
    ignoreDeviations = false,
    rules = null,
    runningCount = null,
  } = {},
) => {
  const h17 = rules ? Boolean(rules.dealerHitsSoft17) : true;
  const das = rules ? Boolean(rules.doubleAfterSplit) : true;
  const surrenderOffered = (rules ? Boolean(rules.lateSurrender) : true) && allowSurrender;

  const dValue = getNumericValue(dUpCard);
  const d = dValue === 11 ? 11 : dValue;
  const p = calculateTotal(pCards);
  const isPair = pCards.length === 2 && getNumericValue(pCards[0]) === getNumericValue(pCards[1]);
  const isSoft = isSoftHand(pCards);
  const isPairOfEights = isPair && getNumericValue(pCards[0]) === 8;
  const isPairOfTens = isPair && getNumericValue(pCards[0]) === 10;
  const zeroIndexCount = Number.isFinite(runningCount) ? runningCount : tc;

  if (!ignoreDeviations) {
    const deviation = getDeviationPlay({
      allowSurrender: surrenderOffered,
      dealer: d,
      isPair,
      isPairOfTens,
      isSoft,
      total: p,
      trueCount: tc,
      zeroIndexCount,
    });
    if (deviation) return deviation;
  }

  // Late surrender on the original two cards, after count-index overrides.
  if (surrenderOffered && pCards.length === 2 && !isSoft) {
    if (isPairOfEights && d === 11 && h17) {
      return basic('surrender', 'Surrender 8s against an Ace when the dealer hits soft 17.');
    }
    if (!isPairOfEights && p === 16 && d >= 9) {
      return basic('surrender', 'Surrender hard 16 against 9, 10, or Ace.');
    }
    if (p === 17 && d === 11 && h17) {
      return basic('surrender', 'Surrender hard 17 against an Ace when the dealer hits soft 17.');
    }
    if (p === 15 && d === 10 && (ignoreDeviations || zeroIndexCount >= 0)) {
      return ignoreDeviations
        ? basic('surrender', 'Surrender hard 15 against a 10.')
        : { action: 'surrender', type: 'H17 Surrender Index', rule: 'Surrender hard 15 vs 10 at a running count of 0 or higher.' };
    }
    if (p === 15 && d === 11 && h17 && ignoreDeviations) {
      return basic('surrender', 'Surrender hard 15 against an Ace when the dealer hits soft 17.');
    }
  }

  // Pairs
  if (isPair) {
    const v = getNumericValue(pCards[0]);
    if (v === 11 || v === 8) return basic('split', 'Always split Aces and 8s.');
    if (v === 10) return basic('stand', 'Never split 20.');
    if (v === 9) return basic((d === 7 || d === 10 || d === 11) ? 'stand' : 'split', 'Split 9s except vs 7, 10, Ace.');
    if (v === 7) return basic(d <= 7 ? 'split' : 'hit', 'Split 7s vs dealer 2-7.');
    if (v === 6) {
      const low = das ? 2 : 3;
      return basic(d >= low && d <= 6 ? 'split' : 'hit', das ? 'Split 6s vs dealer 2-6.' : 'Split 6s vs dealer 3-6 without double after split.');
    }
    if (v === 5) return basic(d <= 9 ? 'double' : 'hit', 'Double 5s like hard 10.');
    if (v === 4) {
      return das
        ? basic((d === 5 || d === 6) ? 'split' : 'hit', 'Split 4s vs 5-6 when double after split is allowed.')
        : basic('hit', 'Never split 4s without double after split; play as hard 8.');
    }
    if (v === 3 || v === 2) {
      const low = das ? 2 : 4;
      return basic(d >= low && d <= 7 ? 'split' : 'hit', das ? 'Split 2s/3s vs dealer 2-7.' : 'Split 2s/3s vs dealer 4-7 without double after split.');
    }
  }

  // Soft totals
  if (isSoft) {
    if (p >= 20) return basic('stand', 'Always stand on soft 20+.');
    if (p === 19) {
      return h17
        ? basic(d === 6 ? 'double' : 'stand', 'Double soft 19 vs 6 when the dealer hits soft 17; otherwise stand.')
        : basic('stand', 'Stand on soft 19.');
    }
    if (p === 18) {
      const doubleLow = h17 ? 2 : 3;
      if (d >= doubleLow && d <= 6) return basic('double', h17 ? 'Double soft 18 vs 2-6.' : 'Double soft 18 vs 3-6.');
      return basic(d <= 8 ? 'stand' : 'hit', 'Stand soft 18 vs 2, 7, 8; hit vs 9-Ace.');
    }
    if (p === 17) return basic((d >= 3 && d <= 6) ? 'double' : 'hit', 'Double soft 17 vs 3-6, otherwise hit.');
    if (p >= 15) return basic((d >= 4 && d <= 6) ? 'double' : 'hit', 'Double soft 15/16 vs 4-6.');
    if (p >= 13) return basic((d >= 5 && d <= 6) ? 'double' : 'hit', 'Double soft 13/14 vs 5-6.');
    return basic('hit', 'Always hit soft totals 13 and under.');
  }

  // Hard totals
  if (p >= 17) return basic('stand', 'Always stand on hard 17+.');
  if (p >= 13 && d <= 6) return basic('stand', 'Stand on hard 13-16 against dealer bust card (2-6).');
  if (p === 12 && d >= 4 && d <= 6) return basic('stand', 'Stand on 12 vs 4-6.');
  if (p === 11) {
    if (d === 11 && !h17) return basic('hit', 'Hit 11 against an Ace when the dealer stands on soft 17.');
    return basic('double', 'Always double down on 11.');
  }
  if (p === 10 && d <= 9) return basic('double', 'Double down on 10 vs 2-9.');
  if (p === 9 && d >= 3 && d <= 6) return basic('double', 'Double down on 9 vs 3-6.');

  return basic('hit', 'Hit stiff totals against strong dealer upcards.');
};
