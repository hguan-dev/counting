import { calculateTotal } from './strategyEngine';

const RANK_NAMES = {
  A: 'ace',
  J: 'jack',
  Q: 'queen',
  K: 'king',
};

export const getSpokenCard = (card) => (
  RANK_NAMES[card?.value] || String(card?.value || 'unknown card')
);

export const getSpokenHandTotal = (cards) => {
  const total = calculateTotal(cards);
  const hardTotal = cards?.reduce((sum, card) => {
    if (card.value === 'A') return sum + 1;
    if (['J', 'Q', 'K'].includes(card.value)) return sum + 10;
    return sum + Number(card.value);
  }, 0) || 0;
  const hasUsableAce = cards?.some(card => card.value === 'A') && hardTotal + 10 <= 21;

  return `${hasUsableAce ? 'soft ' : ''}${total}`;
};

export const parseVoiceAction = (transcript) => {
  const normalized = String(transcript || '').toLowerCase();
  if (/\b(hit|card)\b/.test(normalized)) return 'hit';
  if (/\b(stand|stay|hold)\b/.test(normalized)) return 'stand';
  return null;
};
