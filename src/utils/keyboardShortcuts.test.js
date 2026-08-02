import { describe, expect, it } from 'vitest';
import { getKeyboardCommand } from './keyboardShortcuts';

describe('getKeyboardCommand', () => {
  it.each([
    ['h', 'hit'],
    ['H', 'hit'],
    ['s', 'stand'],
    ['d', 'double'],
    ['p', 'split'],
  ])('maps %s to %s during player action', (key, action) => {
    expect(getKeyboardCommand(key, 'playing')).toEqual({ type: 'action', action });
  });

  it('maps F to fullscreen from any game state', () => {
    expect(getKeyboardCommand('F', 'betting')).toEqual({ type: 'fullscreen' });
  });

  it('maps V to voice mode from any game state', () => {
    expect(getKeyboardCommand('v', 'resolved')).toEqual({ type: 'voiceMode' });
  });

  it('maps I to the active ace decision', () => {
    expect(getKeyboardCommand('i', 'insurance')).toEqual({ type: 'insurance', buy: true });
    expect(getKeyboardCommand('I', 'evenMoney')).toEqual({ type: 'evenMoney', accept: true });
  });

  it('does not run action shortcuts outside the playing state', () => {
    expect(getKeyboardCommand('h', 'betting')).toBeNull();
    expect(getKeyboardCommand('i', 'playing')).toBeNull();
  });
});
