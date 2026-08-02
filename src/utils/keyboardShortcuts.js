const PLAYING_SHORTCUTS = {
  d: 'double',
  h: 'hit',
  p: 'split',
  r: 'surrender',
  s: 'stand',
};

export const getKeyboardCommand = (key, gameState) => {
  const normalizedKey = key.toLowerCase();

  if (normalizedKey === 'f') return { type: 'fullscreen' };
  if (normalizedKey === 'v') return { type: 'voiceMode' };
  if (gameState === 'playing' && PLAYING_SHORTCUTS[normalizedKey]) {
    return { type: 'action', action: PLAYING_SHORTCUTS[normalizedKey] };
  }
  if (normalizedKey === 'i' && gameState === 'insurance') {
    return { type: 'insurance', buy: true };
  }
  if (normalizedKey === 'i' && gameState === 'evenMoney') {
    return { type: 'evenMoney', accept: true };
  }

  return null;
};
