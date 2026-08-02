import { describe, expect, test } from 'vitest';
import { Card } from '../models/Card';
import {
  choosePreferredTableVoice,
  getDealerCardCall,
  getDealerFinishCall,
  getRecognitionErrorMessage,
  getRecognitionResult,
  getSpokenCard,
  getSpokenCountSummary,
  getSpokenHandTotal,
  parseVoiceAction,
  parseVoiceCommand,
  scoreTableVoice,
  shouldDispatchInterimCommand,
} from './tableSpeech';

describe('table speech', () => {
  test('turns card ranks and hand totals into natural speech', () => {
    expect(getSpokenCard(new Card('♥', 'A'))).toBe('ace');
    expect(getSpokenCard(new Card('♠', '10'))).toBe('10');
    expect(getSpokenHandTotal([new Card('♥', 'A'), new Card('♠', '6')])).toBe('soft 17');
    expect(getSpokenHandTotal([
      new Card('♥', 'A'),
      new Card('♦', 'A'),
      new Card('♠', '9'),
    ])).toBe('soft 21');
    expect(getSpokenHandTotal([new Card('♥', '10'), new Card('♠', '7')])).toBe('17');
  });

  test('speaks the full count with approximate decks remaining', () => {
    expect(getSpokenCountSummary(5, 2, 2.34)).toBe(
      'The running count is 5. The true count is 2. Approximately 2.5 decks remaining.',
    );
  });

  test('keeps dealer reveal calls short and card-by-card', () => {
    expect(getDealerCardCall(new Card('♥', '4'))).toBe('4.');
    expect(getDealerFinishCall([
      new Card('♥', '5'),
      new Card('♠', '4'),
      new Card('♦', '3'),
      new Card('♣', '10'),
    ])).toBe('Too many. Dealer busts.');
    expect(getDealerFinishCall([
      new Card('♥', '10'),
      new Card('♠', '7'),
    ])).toBe('Dealer 17.');
  });

  test('recognizes hit and stand commands without substring false positives', () => {
    expect(parseVoiceAction('hit me')).toBe('hit');
    expect(parseVoiceAction('I will stand')).toBe('stand');
    expect(parseVoiceAction('stay')).toBe('stand');
    expect(parseVoiceAction("I'm good")).toBe('stand');
    expect(parseVoiceAction('good')).toBe('stand');
    expect(parseVoiceAction('face down')).toBe('doubleFaceDown');
    expect(parseVoiceAction('face up')).toBe('double');
    expect(parseVoiceAction('I understand')).toBeNull();
    expect(parseVoiceAction('double down')).toBe('double');
  });

  test('parses per-spot wager configurations from natural speech', () => {
    expect(parseVoiceCommand('one spot bet 25')).toEqual({
      type: 'configureBets',
      spotCount: 1,
      bets: [25],
    });
    expect(parseVoiceCommand('two spots, bet twenty five and fifty')).toEqual({
      type: 'configureBets',
      spotCount: 2,
      bets: [25, 50],
    });
    expect(parseVoiceCommand('spot one bet 50 and spot two bet 100')).toEqual({
      type: 'configureBets',
      spotCount: 2,
      bets: [50, 100],
    });
  });

  test('parses every table decision and utility command', () => {
    expect(parseVoiceCommand('double down')).toEqual({ type: 'action', action: 'double' });
    expect(parseVoiceCommand('resplit')).toEqual({ type: 'action', action: 'split' });
    expect(parseVoiceCommand('buy insurance')).toEqual({ type: 'insurance', buy: true });
    expect(parseVoiceCommand('no insurance')).toEqual({ type: 'insurance', buy: false });
    expect(parseVoiceCommand('take even money')).toEqual({ type: 'evenMoney', accept: true });
    expect(parseVoiceCommand('play it out')).toEqual({ type: 'evenMoney', accept: false });
    expect(parseVoiceCommand('reload five hundred dollars')).toEqual({ type: 'reload', amount: 500 });
    expect(parseVoiceCommand('next round')).toEqual({ type: 'nextRound' });
    expect(parseVoiceCommand('next')).toEqual({ type: 'nextRound' });
    expect(parseVoiceCommand('run it')).toEqual({ type: 'runIt' });
    expect(parseVoiceCommand('stack it')).toEqual({ type: 'stackBet' });
    expect(parseVoiceCommand('stack it up')).toEqual({ type: 'stackAndRun' });
    expect(parseVoiceCommand('bang')).toEqual({ type: 'celebrate' });
    expect(parseVoiceCommand('fuck')).toEqual({ type: 'sickReaction' });
    expect(parseVoiceCommand('sickening')).toEqual({ type: 'sickReaction' });
    expect(parseVoiceCommand('how sick is that')).toEqual({ type: 'sickReaction' });
    expect(parseVoiceCommand('what is the true count')).toEqual({ type: 'count', enabled: true });
    expect(parseVoiceCommand('count off')).toEqual({ type: 'count', enabled: false });
    expect(parseVoiceCommand('dealer give me a tip')).toEqual({ type: 'tip' });
    expect(parseVoiceCommand("what's the move")).toEqual({ type: 'tip' });
    expect(parseVoiceCommand('what should I do')).toEqual({ type: 'tip' });
    expect(parseVoiceCommand('dealer voice off')).toEqual({ type: 'speech', enabled: false });
    expect(parseVoiceCommand('dealer voice')).toEqual({ type: 'speech', enabled: true });
    expect(parseVoiceCommand('strategy guard on')).toEqual({ type: 'guard', enabled: true });
    expect(parseVoiceCommand('open the study guide')).toEqual({ type: 'studyGuide', open: true });
    expect(parseVoiceCommand('study guide')).toEqual({ type: 'studyGuide', open: true });
    expect(parseVoiceCommand('study guide off')).toEqual({ type: 'studyGuide', open: false });
    expect(parseVoiceCommand('microphone test')).toEqual({ type: 'micTest' });
  });

  test('uses a parseable recognition alternative instead of dropping the command', () => {
    const result = [
      { transcript: 'I understand' },
      { transcript: 'stand' },
      { transcript: 'stay' },
    ];
    result.isFinal = true;

    expect(getRecognitionResult({ resultIndex: 0, results: [result] })).toEqual({
      command: { type: 'action', action: 'stand' },
      isFinal: true,
      transcript: 'stand',
    });
  });

  test('keeps interim speech visible without dispatching it', () => {
    const result = [{ transcript: 'two spots bet twenty' }];
    result.isFinal = false;

    expect(getRecognitionResult({ resultIndex: 0, results: [result] })).toEqual({
      command: {
        type: 'configureBets',
        spotCount: 2,
        bets: [20],
      },
      isFinal: false,
      transcript: 'two spots bet twenty',
    });
  });

  test('eagerly dispatches complete commands but waits on ambiguous prefixes', () => {
    expect(shouldDispatchInterimCommand('hit', parseVoiceCommand('hit'))).toBe(true);
    expect(shouldDispatchInterimCommand('run it', parseVoiceCommand('run it'))).toBe(true);
    expect(shouldDispatchInterimCommand('face down', parseVoiceCommand('face down'))).toBe(true);
    expect(shouldDispatchInterimCommand('count off', parseVoiceCommand('count off'))).toBe(true);
    expect(shouldDispatchInterimCommand('count', parseVoiceCommand('count'))).toBe(false);
    expect(shouldDispatchInterimCommand('stack it', parseVoiceCommand('stack it'))).toBe(false);
    expect(shouldDispatchInterimCommand('stack it up', parseVoiceCommand('stack it up'))).toBe(true);
    expect(shouldDispatchInterimCommand(
      'two spots bet twenty',
      parseVoiceCommand('two spots bet twenty'),
    )).toBe(false);
  });

  test('explains microphone and speech-service failures', () => {
    expect(getRecognitionErrorMessage('not-allowed')).toContain('site settings');
    expect(getRecognitionErrorMessage('audio-capture')).toContain('microphone');
    expect(getRecognitionErrorMessage('network')).toContain('speech recognition service');
    expect(getRecognitionErrorMessage('something-new')).toContain('stopped unexpectedly');
  });

  test('prefers natural premium English voices over robotic fallbacks', () => {
    const voices = [
      { name: 'English Compact', lang: 'en-US', localService: true },
      { name: 'Samantha Premium', lang: 'en-US', localService: true },
      { name: 'Generic French', lang: 'fr-FR', localService: true },
    ];

    expect(scoreTableVoice(voices[1])).toBeGreaterThan(scoreTableVoice(voices[0]));
    expect(choosePreferredTableVoice(voices)).toEqual(voices[1]);
  });
});
