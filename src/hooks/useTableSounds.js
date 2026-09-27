import { useEffect, useRef, useState } from 'react';

const SOUND_PATTERNS = {
  card: [[620, 0.035, 0], [420, 0.045, 0.04]],
  chips: [[280, 0.05, 0], [390, 0.06, 0.05], [520, 0.08, 0.11]],
  deal: [[440, 0.045, 0], [560, 0.045, 0.06], [680, 0.06, 0.12]],
  loss: [[330, 0.08, 0], [245, 0.14, 0.09]],
  stand: [[360, 0.08, 0]],
  win: [[520, 0.07, 0], [660, 0.07, 0.08], [820, 0.12, 0.16]],
};

const readStoredFlag = (key, fallback) => {
  if (typeof window === 'undefined') return fallback;
  const stored = window.localStorage.getItem(key);
  return stored === null ? fallback : stored === 'true';
};

export default function useTableSounds() {
  const [soundEnabled, setSoundEnabled] = useState(() => readStoredFlag('blackjack-sound-enabled', true));
  const audioContextRef = useRef(null);

  const playSound = (type) => {
    if (!soundEnabled || typeof window === 'undefined') return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;

    const context = audioContextRef.current || new AudioContext();
    audioContextRef.current = context;
    if (context.state === 'suspended') context.resume();

    (SOUND_PATTERNS[type] || SOUND_PATTERNS.card).forEach(([frequency, duration, delay]) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const start = context.currentTime + delay;
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.055, start + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + duration + 0.01);
    });
  };

  useEffect(() => {
    window.localStorage.setItem('blackjack-sound-enabled', String(soundEnabled));
  }, [soundEnabled]);

  useEffect(() => () => {
    audioContextRef.current?.close();
  }, []);

  return { playSound, setSoundEnabled, soundEnabled };
}
