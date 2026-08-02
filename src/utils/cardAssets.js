const CARD_ASSET_BASE = '/cards';

const RANK_NAMES = {
  A: 'ace',
  J: 'jack',
  Q: 'queen',
  K: 'king',
};

const SUIT_NAMES = {
  '♣': 'clubs',
  '♦': 'diamonds',
  '♥': 'hearts',
  '♠': 'spades',
};

export const getCardAssetName = (card) => {
  if (!card || !RANK_NAMES[card.value] && !/^(?:[2-9]|10)$/.test(card.value)) return null;
  const suit = SUIT_NAMES[card.suit];
  if (!suit) return null;
  return `${RANK_NAMES[card.value] || card.value}_of_${suit}`;
};

export const getCardAssetUrl = (card) => {
  const assetName = getCardAssetName(card);
  return assetName ? `${CARD_ASSET_BASE}/${assetName}.svg` : null;
};
