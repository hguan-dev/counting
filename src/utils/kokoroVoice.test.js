import { readFile, stat } from 'node:fs/promises';
import { describe, expect, test } from 'vitest';
import { DEALER_CARD_CALLS, HEART_TABLE_PHRASES } from './heartVoicePhrases';
import { KOKORO_VOICES, preloadKokoro, preloadKokoroVoice } from './kokoroVoice';

describe('Kokoro dealer voices', () => {
  test('offers a small, curated set with unique model voice IDs', () => {
    expect(KOKORO_VOICES.map(voice => voice.id)).toEqual([
      'af_heart',
      'af_bella',
      'bf_emma',
      'am_fenrir',
    ]);
    expect(new Set(KOKORO_VOICES.map(voice => voice.id)).size).toBe(KOKORO_VOICES.length);
    expect(KOKORO_VOICES.every(voice => !/grade/i.test(voice.label))).toBe(true);
    expect(preloadKokoro).toBeTypeOf('function');
    expect(preloadKokoroVoice).toBeTypeOf('function');
  });

  test('precomputes the reusable Heart table vocabulary without duplicates', () => {
    expect(HEART_TABLE_PHRASES.length).toBeGreaterThan(100);
    expect(new Set(HEART_TABLE_PHRASES).size).toBe(HEART_TABLE_PHRASES.length);
    expect(HEART_TABLE_PHRASES).toContain('Dealer upcard ace.');
    expect(HEART_TABLE_PHRASES).toContain('Player draws king.');
    expect(HEART_TABLE_PHRASES).toContain('Total soft 17.');
    expect(HEART_TABLE_PHRASES).toContain('Split hand 4.');
    expect(DEALER_CARD_CALLS).toHaveLength(13);
  });

  test('ships one non-empty Heart audio asset for every precomputed phrase', async () => {
    const audioDirectory = new URL('../../public/audio/heart/', import.meta.url);
    const manifest = JSON.parse(await readFile(new URL('manifest.json', audioDirectory), 'utf8'));
    expect(manifest).toEqual({ phrases: HEART_TABLE_PHRASES, voice: 'af_heart' });

    const sizes = await Promise.all(HEART_TABLE_PHRASES.map((_, index) => (
      stat(new URL(`${String(index).padStart(3, '0')}.mp3`, audioDirectory))
        .then(file => file.size)
    )));
    expect(sizes.every(size => size > 0)).toBe(true);
  });
});
