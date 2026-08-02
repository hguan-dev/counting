import { calculateTotal } from './strategyEngine';

const RANK_NAMES = {
  A: 'ace',
  J: 'jack',
  Q: 'queen',
  K: 'king',
};

const PREMIUM_VOICE_NAMES = [
  'ava',
  'samantha',
  'allison',
  'serena',
  'daniel',
  'aria',
  'jenny',
  'guy',
  'google us english',
  'google uk english',
];

export const scoreTableVoice = (voice) => {
  const name = String(voice?.name || '').toLowerCase();
  const lang = String(voice?.lang || '').toLowerCase();
  let score = 0;
  if (lang === 'en-us') score += 40;
  else if (lang.startsWith('en-')) score += 30;
  if (/\b(premium|enhanced|natural|neural)\b/.test(name)) score += 80;
  const preferredIndex = PREMIUM_VOICE_NAMES.findIndex(preferred => name.includes(preferred));
  if (preferredIndex >= 0) score += 60 - preferredIndex;
  if (voice?.localService) score += 8;
  if (/\b(compact|espeak|robot)\b/.test(name)) score -= 80;
  return score;
};

export const choosePreferredTableVoice = (voices) => (
  [...(voices || [])]
    .filter(voice => String(voice.lang || '').toLowerCase().startsWith('en'))
    .sort((left, right) => scoreTableVoice(right) - scoreTableVoice(left))[0] || null
);

export const getSpokenCard = (card) => (
  RANK_NAMES[card?.value] || String(card?.value || 'unknown card')
);

export const getDealerCardCall = (card) => `${getSpokenCard(card)}.`;

export const getDealerFinishCall = (cards) => {
  const total = calculateTotal(cards);
  return total > 21 ? 'Too many.' : `Dealer ${total}.`;
};

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

export const getSpokenCountSummary = (runningCount, trueCount, decksRemaining) => {
  const approximateDecks = Math.round(Number(decksRemaining) * 2) / 2;
  return `The running count is ${runningCount}. The true count is ${trueCount}. Approximately ${approximateDecks} decks remaining.`;
};

const SMALL_NUMBERS = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
};

const parseNumberPhrase = (phrase) => {
  const digitMatch = phrase.match(/\d+(?:\.\d+)?/);
  if (digitMatch) return Number(digitMatch[0]);

  let current = 0;
  let total = 0;
  let found = false;
  phrase.split(/\s+/).forEach(word => {
    if (SMALL_NUMBERS[word] !== undefined) {
      current += SMALL_NUMBERS[word];
      found = true;
    } else if (word === 'hundred') {
      current = Math.max(1, current) * 100;
      found = true;
    } else if (word === 'thousand') {
      total += Math.max(1, current) * 1000;
      current = 0;
      found = true;
    }
  });
  return found ? total + current : null;
};

const parseBetAmounts = (phrase) => (
  phrase
    .replace(/\bdollars?\b/g, '')
    .split(/\s+(?:and|then)\s+|,/)
    .map(part => parseNumberPhrase(part.trim()))
    .filter(amount => Number.isFinite(amount))
);

export const parseVoiceCommand = (transcript) => {
  const normalized = String(transcript || '')
    .toLowerCase()
    .replace(/[$:]/g, ' ')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) return null;

  const spotsThenBet = normalized.match(/\b(one|two|1|2)\s+spots?\b.*?\bbets?\b(.+)$/);
  if (spotsThenBet) {
    return {
      type: 'configureBets',
      spotCount: parseNumberPhrase(spotsThenBet[1]),
      bets: parseBetAmounts(spotsThenBet[2]),
    };
  }

  const explicitSpotBets = normalized.match(
    /\bspot\s+(?:one|1)\s+(?:bet\s+)?(.+?)\s+(?:and\s+)?spot\s+(?:two|2)\s+(?:bet\s+)?(.+)$/,
  );
  if (explicitSpotBets) {
    return {
      type: 'configureBets',
      spotCount: 2,
      bets: [
        parseNumberPhrase(explicitSpotBets[1]),
        parseNumberPhrase(explicitSpotBets[2]),
      ].filter(amount => Number.isFinite(amount)),
    };
  }

  const betOnly = normalized.match(/\bbets?\b(?:\s+(?:is|to|of))?\s+(.+)$/);
  if (betOnly) {
    return { type: 'configureBets', spotCount: null, bets: parseBetAmounts(betOnly[1]) };
  }

  const spotsOnly = normalized.match(/\b(one|two|1|2)\s+spots?\b/);
  if (spotsOnly) {
    return { type: 'setSpots', spotCount: parseNumberPhrase(spotsOnly[1]) };
  }

  const reload = normalized.match(/\b(?:reload|add|buy\s+in)\b.*?(\d+(?:\.\d+)?|[a-z\s]+?)(?:\s+dollars?)?$/);
  if (reload) {
    const amount = parseNumberPhrase(reload[1]);
    if (Number.isFinite(amount)) return { type: 'reload', amount };
  }

  if (/\b(?:take|accept|yes)\s+even\s+money\b|\beven\s+money\s+yes\b/.test(normalized)) return { type: 'evenMoney', accept: true };
  if (/\b(?:decline|no|skip)\s+even\s+money\b|\bplay\s+it\s+out\b/.test(normalized)) return { type: 'evenMoney', accept: false };
  if (/\b(?:buy|take|yes)\s+insurance\b|\binsurance\s+yes\b/.test(normalized)) return { type: 'insurance', buy: true };
  if (/\b(?:decline|no|skip)\s+insurance\b|\bno\s+insurance\b/.test(normalized)) return { type: 'insurance', buy: false };

  if (/\bface\s+down\b/.test(normalized)) return { type: 'action', action: 'doubleFaceDown' };
  if (/\bface\s+up\b/.test(normalized)) return { type: 'action', action: 'double' };
  if (/\b(hit|card)\b/.test(normalized)) return { type: 'action', action: 'hit' };
  if (/^(?:i(?:'| a)?m\s+good|good)$/.test(normalized)) return { type: 'action', action: 'stand' };
  if (/\b(stand|stay|hold)\b/.test(normalized)) return { type: 'action', action: 'stand' };
  if (/\bdouble(?:\s+down)?\b/.test(normalized)) return { type: 'action', action: 'double' };
  if (/\b(?:split|resplit)\b/.test(normalized)) return { type: 'action', action: 'split' };
  if (/\bsurrender\b/.test(normalized)) return { type: 'action', action: 'surrender' };
  if (/\brun\s+it\b/.test(normalized)) return { type: 'runIt' };
  if (/\bstack\s+it\s+up\b/.test(normalized)) return { type: 'stackAndRun' };
  if (/\bstack\s+it\b/.test(normalized)) return { type: 'stackBet' };
  if (/^(?:next|next\s+round|new\s+round|deal\s+again)$/.test(normalized)) return { type: 'nextRound' };
  if (/\b(?:deal|deal\s+cards|start\s+round)\b/.test(normalized)) return { type: 'deal' };
  if (/\bba+n+g+\b|\bgood\s+boy\b/.test(normalized)) return { type: 'celebrate' };
  if (/\b(?:bro|fuck|seriously|sickening|sick)\b|\bare\s+you\s+serious\b/.test(normalized)) return { type: 'sickReaction' };
  if (/\b(?:proceed|do\s+it|play\s+anyway)\b/.test(normalized)) return { type: 'proceed' };
  if (/\b(?:correct\s+play|go\s+back|cancel)\b/.test(normalized)) return { type: 'cancel' };
  if (/\b(?:tip|hint|advice|recommended\s+(?:move|play)|correct\s+move|what\s+should\s+i\s+do|what(?:'s|\s+is)\s+the\s+(?:move|play))\b/.test(normalized)) return { type: 'tip' };
  if (/^(?:count|running\s+count|true\s+count)\s+(?:off|hide)$/.test(normalized)) return { type: 'count', enabled: false };
  if (/\b(?:running\s+count|true\s+count|count)(?:\s+(?:on|show))?\b/.test(normalized)) return { type: 'count', enabled: true };
  if (/\b(?:bankroll|balance)\b/.test(normalized)) return { type: 'bankroll' };
  if (/\b(?:repeat|status|what\s+can\s+i\s+do)\b/.test(normalized)) return { type: 'status' };
  if (/\b(?:microphone|mic|voice)\s+(?:test|check)\b/.test(normalized)) return { type: 'micTest' };
  if (/\b(?:help|voice\s+help|commands)\b/.test(normalized)) return { type: 'help' };
  if (/\b(?:dealer\s+voice|narration)\s+(?:off|mute)\b/.test(normalized)) return { type: 'speech', enabled: false };
  if (/^(?:dealer\s+voice|narration)(?:\s+on)?$/.test(normalized)) return { type: 'speech', enabled: true };
  if (/^(?:exit|leave)\s+full\s*screen$|^full\s*screen\s+off$/.test(normalized)) return { type: 'fullscreen', enabled: false };
  if (/^(?:enter\s+)?full\s*screen(?:\s+on)?$/.test(normalized)) return { type: 'fullscreen', enabled: true };
  if (/\b(?:guard|strategy\s+guard)\s+off\b/.test(normalized)) return { type: 'guard', enabled: false };
  if (/\b(?:guard|strategy\s+guard)\s+on\b/.test(normalized)) return { type: 'guard', enabled: true };
  if (/\bpopups?\s+off\b/.test(normalized)) return { type: 'popups', enabled: false };
  if (/\bpopups?\s+on\b/.test(normalized)) return { type: 'popups', enabled: true };
  if (/^(?:(?:close|hide)\s+(?:the\s+)?study\s+guide|study\s+guide\s+off)$/.test(normalized)) return { type: 'studyGuide', open: false };
  if (/^(?:(?:open|show)\s+(?:the\s+)?study\s+guide|study\s+guide(?:\s+on)?)$/.test(normalized)) return { type: 'studyGuide', open: true };
  if (/\bexport\b/.test(normalized)) return { type: 'export' };
  if (/\b(?:mute|sound\s+off)\b/.test(normalized)) return { type: 'sound', enabled: false };
  if (/\b(?:unmute|sound\s+on)\b/.test(normalized)) return { type: 'sound', enabled: true };

  return null;
};

export const parseVoiceAction = (transcript) => {
  const command = parseVoiceCommand(transcript);
  return command?.type === 'action' ? command.action : null;
};

export const shouldDispatchInterimCommand = (transcript, command) => {
  if (!command) return false;
  const normalized = String(transcript || '').toLowerCase().trim().replace(/[.!?]+$/, '');

  if ([
    'action',
    'cancel',
    'celebrate',
    'evenMoney',
    'insurance',
    'nextRound',
    'proceed',
    'runIt',
    'sickReaction',
    'stackAndRun',
    'tip',
  ].includes(command.type)) return true;

  if (command.type === 'count') return command.enabled === false;
  if (command.type === 'speech') {
    return command.enabled === false || /\bon$/.test(normalized);
  }
  if (command.type === 'studyGuide') {
    return command.open === false || /^(?:open|show)\b|\bon$/.test(normalized);
  }
  if (command.type === 'fullscreen') {
    return command.enabled === false || /\bon$/.test(normalized);
  }
  return ['guard', 'popups', 'sound'].includes(command.type);
};

export const getRecognitionResult = (event) => {
  const resultIndex = Number.isInteger(event?.resultIndex)
    ? event.resultIndex
    : Math.max(0, (event?.results?.length || 1) - 1);
  const result = event?.results?.[resultIndex];
  if (!result) return null;

  const alternatives = Array.from(result)
    .map(alternative => String(alternative?.transcript || '').trim())
    .filter(Boolean);
  const recognized = alternatives
    .map(transcript => ({ transcript, command: parseVoiceCommand(transcript) }))
    .find(candidate => candidate.command);

  return {
    command: recognized?.command || null,
    isFinal: Boolean(result.isFinal),
    transcript: recognized?.transcript || alternatives[0] || '',
  };
};

export const getRecognitionErrorMessage = (errorCode) => {
  const messages = {
    'aborted': 'Microphone listening was interrupted.',
    'audio-capture': 'No working microphone input was found.',
    'bad-grammar': 'The speech service could not load its command grammar.',
    'language-not-supported': 'Speech recognition does not support this language.',
    'network': 'The browser could not reach its speech recognition service.',
    'no-speech': 'No speech was detected. Move closer and try again.',
    'not-allowed': 'Microphone access is blocked. Allow it in the browser site settings.',
    'service-not-allowed': 'The browser speech recognition service is blocked.',
  };
  return messages[errorCode] || 'Speech recognition stopped unexpectedly. Try turning voice mode off and on.';
};

export const getRecognitionFailure = (errorCode) => {
  const isBlocking = [
    'audio-capture',
    'language-not-supported',
    'not-allowed',
    'service-not-allowed',
  ].includes(errorCode);

  return {
    message: getRecognitionErrorMessage(errorCode),
    restartAllowed: !isBlocking && errorCode !== 'network',
    status: isBlocking ? 'blocked' : 'error',
  };
};

export const configureRecognition = (recognition, language = 'en-US') => {
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.maxAlternatives = 5;
  recognition.lang = language || 'en-US';
  return recognition;
};
