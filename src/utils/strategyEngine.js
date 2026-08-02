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

const getNumericValue = (card) => (
  card.numericValue !== undefined
    ? card.numericValue
    : (['J', 'Q', 'K'].includes(card.value) ? 10 : card.value === 'A' ? 11 : Number(card.value))
);

export const getDetailedPlay = (pCards, dUpCard, tc, { allowSurrender = true } = {}) => {
  const dValue = getNumericValue(dUpCard);
  const d = dValue === 11 ? 11 : dValue;
  const p = calculateTotal(pCards);
  const isPair = pCards.length === 2 && getNumericValue(pCards[0]) === getNumericValue(pCards[1]);
  const isSoft = pCards.length === 2 && pCards.some(c => c.value === 'A') && p <= 21;
  const isPairOfEights = isPair && getNumericValue(pCards[0]) === 8;

  // Six-deck H17 late surrender, including Hi-Lo Fabulous 4 indices.
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
    if (p === 15 && d === 10 && tc >= 0) {
      return { action: 'surrender', type: 'Deviation (Fabulous 4)', rule: 'Surrender 15 vs 10 at TC ≥ 0.' };
    }
    if (p === 15 && d === 11 && tc >= 1) {
      return { action: 'surrender', type: 'Deviation (Fabulous 4)', rule: 'Surrender 15 vs Ace at TC ≥ +1.' };
    }
    if (p === 15 && d === 9 && tc >= 2) {
      return { action: 'surrender', type: 'Deviation (Fabulous 4)', rule: 'Surrender 15 vs 9 at TC ≥ +2.' };
    }
    if (p === 14 && d === 10 && tc >= 3) {
      return { action: 'surrender', type: 'Deviation (Fabulous 4)', rule: 'Surrender 14 vs 10 at TC ≥ +3.' };
    }
  }

  // Illustrious 18 Deviations
  if (!isPair && p === 16 && d === 10 && tc >= 0) return { action: 'stand', type: 'Deviation (Illustrious 18)', rule: 'Stand on 16 vs 10 at TC ≥ 0.' };
  if (p === 15 && d === 10 && tc >= 4) return { action: 'stand', type: 'Deviation (Illustrious 18)', rule: 'Stand on 15 vs 10 at TC ≥ +4.' };
  if (p === 11 && d === 11 && tc >= 1) return { action: 'double', type: 'Deviation (Illustrious 18)', rule: 'Double 11 vs Ace at TC ≥ +1.' };
  if (p === 10 && d === 10 && tc >= 4) return { action: 'double', type: 'Deviation (Illustrious 18)', rule: 'Double 10 vs 10 at TC ≥ +4.' };

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
    if (p >= 19) return { action: 'stand', type: 'Basic Strategy', rule: 'Always stand on soft 19+.' };
    if (p === 18) return { action: (d >= 3 && d <= 6) ? 'double' : (d <= 8 ? 'stand' : 'hit'), type: 'Basic Strategy', rule: 'Double soft 18 vs 3-6, stand on 2,7,8.' };
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
