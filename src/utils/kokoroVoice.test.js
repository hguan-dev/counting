import { describe, expect, test } from 'vitest';
import { KOKORO_VOICES } from './kokoroVoice';

describe('Kokoro dealer voices', () => {
  test('offers a small, curated set with unique model voice IDs', () => {
    expect(KOKORO_VOICES.map(voice => voice.id)).toEqual([
      'af_heart',
      'af_bella',
      'bf_emma',
      'am_fenrir',
    ]);
    expect(new Set(KOKORO_VOICES.map(voice => voice.id)).size).toBe(KOKORO_VOICES.length);
  });
});
