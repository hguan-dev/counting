import { describe, expect, test } from 'vitest';
import { Card } from '../models/Card';
import {
  choosePreferredTableVoice,
  getSpokenCard,
  getSpokenHandTotal,
  parseVoiceAction,
  parseVoiceCommand,
  scoreTableVoice,
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

  test('recognizes hit and stand commands without substring false positives', () => {
    expect(parseVoiceAction('hit me')).toBe('hit');
    expect(parseVoiceAction('I will stand')).toBe('stand');
    expect(parseVoiceAction('stay')).toBe('stand');
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
    expect(parseVoiceCommand('what is the true count')).toEqual({ type: 'count' });
    expect(parseVoiceCommand('dealer voice off')).toEqual({ type: 'speech', enabled: false });
    expect(parseVoiceCommand('strategy guard on')).toEqual({ type: 'guard', enabled: true });
    expect(parseVoiceCommand('open the study guide')).toEqual({ type: 'studyGuide', open: true });
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
