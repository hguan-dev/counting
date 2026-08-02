import { describe, expect, test } from 'vitest';
import { Card } from '../models/Card';
import {
  getSpokenCard,
  getSpokenHandTotal,
  parseVoiceAction,
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
    expect(parseVoiceAction('double down')).toBeNull();
  });
});
