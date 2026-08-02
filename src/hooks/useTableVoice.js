import { useEffect, useRef, useState } from 'react';
import { parseVoiceAction } from '../utils/tableSpeech';

const SOUND_PATTERNS = {
  card: [[620, 0.035, 0], [420, 0.045, 0.04]],
  chips: [[280, 0.05, 0], [390, 0.06, 0.05], [520, 0.08, 0.11]],
  deal: [[440, 0.045, 0], [560, 0.045, 0.06], [680, 0.06, 0.12]],
  loss: [[330, 0.08, 0], [245, 0.14, 0.09]],
  stand: [[360, 0.08, 0]],
  win: [[520, 0.07, 0], [660, 0.07, 0.08], [820, 0.12, 0.16]],
};

export default function useTableVoice({ isPlaying, onCommand }) {
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [speechEnabled, setSpeechEnabled] = useState(true);
  const [voiceInputEnabled, setVoiceInputEnabled] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState('off');
  const [lastHeard, setLastHeard] = useState('');
  const [voiceSupported] = useState(() => (
    typeof window !== 'undefined'
    && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition)
  ));

  const audioContextRef = useRef(null);
  const recognitionRef = useRef(null);
  const onCommandRef = useRef(onCommand);
  const isPlayingRef = useRef(isPlaying);
  const voiceInputEnabledRef = useRef(voiceInputEnabled);

  onCommandRef.current = onCommand;
  isPlayingRef.current = isPlaying;
  voiceInputEnabledRef.current = voiceInputEnabled;

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

  const stopListening = () => {
    try {
      recognitionRef.current?.stop();
    } catch {
      // The browser throws when recognition is already stopped.
    }
    setVoiceStatus(voiceInputEnabledRef.current ? 'ready' : 'off');
  };

  const startListening = () => {
    if (!voiceInputEnabledRef.current || !isPlayingRef.current || !recognitionRef.current) return;
    try {
      recognitionRef.current.start();
      setVoiceStatus('listening');
    } catch {
      setVoiceStatus('ready');
    }
  };

  const ensureRecognition = () => {
    if (!voiceSupported || recognitionRef.current) return recognitionRef.current;
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new Recognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript || '';
      const action = parseVoiceAction(transcript);
      setLastHeard(transcript);
      setVoiceStatus(action ? 'heard' : 'ready');
      if (action && isPlayingRef.current) onCommandRef.current?.(action);
    };
    recognition.onerror = (event) => {
      setVoiceStatus(event.error === 'not-allowed' ? 'blocked' : 'ready');
    };
    recognition.onend = () => {
      setVoiceStatus(current => (
        current === 'blocked' || !voiceInputEnabledRef.current ? current : 'ready'
      ));
    };
    recognitionRef.current = recognition;
    return recognition;
  };

  const toggleVoiceInput = () => {
    if (!voiceSupported) return;
    if (voiceInputEnabledRef.current) {
      voiceInputEnabledRef.current = false;
      setVoiceInputEnabled(false);
      stopListening();
      return;
    }

    ensureRecognition();
    voiceInputEnabledRef.current = true;
    setVoiceInputEnabled(true);
    setVoiceStatus('ready');
    if (isPlayingRef.current) startListening();
  };

  const announce = (text, { listenAfter = false } = {}) => {
    if (typeof window === 'undefined') return;
    if (recognitionRef.current) stopListening();

    const beginListening = () => {
      if (listenAfter) startListening();
    };

    if (!speechEnabled || !window.speechSynthesis) {
      beginListening();
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new window.SpeechSynthesisUtterance(text);
    utterance.rate = 0.96;
    utterance.pitch = 0.92;
    utterance.volume = 0.9;
    utterance.onend = beginListening;
    utterance.onerror = beginListening;
    window.speechSynthesis.speak(utterance);
  };

  useEffect(() => {
    if (!isPlaying) {
      stopListening();
    } else if (voiceInputEnabledRef.current) {
      startListening();
    }
  }, [isPlaying]);

  useEffect(() => () => {
    recognitionRef.current?.abort();
    window.speechSynthesis?.cancel();
    audioContextRef.current?.close();
  }, []);

  return {
    announce,
    lastHeard,
    playSound,
    setSoundEnabled,
    setSpeechEnabled,
    soundEnabled,
    speechEnabled,
    toggleVoiceInput,
    voiceInputEnabled,
    voiceStatus,
    voiceSupported,
  };
}
