import { useEffect, useRef, useState } from 'react';
import {
  choosePreferredTableVoice,
  configureRecognition,
  getRecognitionFailure,
  getRecognitionResult,
  scoreTableVoice,
} from '../utils/tableSpeech';
import {
  KOKORO_VOICES,
  speakWithKokoro,
  stopKokoroSpeech,
} from '../utils/kokoroVoice';

const SOUND_PATTERNS = {
  card: [[620, 0.035, 0], [420, 0.045, 0.04]],
  chips: [[280, 0.05, 0], [390, 0.06, 0.05], [520, 0.08, 0.11]],
  deal: [[440, 0.045, 0], [560, 0.045, 0.06], [680, 0.06, 0.12]],
  loss: [[330, 0.08, 0], [245, 0.14, 0.09]],
  stand: [[360, 0.08, 0]],
  win: [[520, 0.07, 0], [660, 0.07, 0.08], [820, 0.12, 0.16]],
};

export default function useTableVoice({ isListeningAllowed, onCommand }) {
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [speechEnabled, setSpeechEnabled] = useState(true);
  const [voiceInputEnabled, setVoiceInputEnabled] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState('off');
  const [voiceError, setVoiceError] = useState('');
  const [voiceModelStatus, setVoiceModelStatus] = useState('ready');
  const [voiceModelProgress, setVoiceModelProgress] = useState(0);
  const [lastHeard, setLastHeard] = useState('');
  const [lastAnnouncement, setLastAnnouncement] = useState('');
  const [availableVoices, setAvailableVoices] = useState([]);
  const [selectedVoiceName, setSelectedVoiceName] = useState(() => (
    typeof window !== 'undefined' ? window.localStorage.getItem('blackjack-dealer-voice') || '' : ''
  ));
  const [voiceSupported] = useState(() => (
    typeof window !== 'undefined'
    && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition)
  ));

  const audioContextRef = useRef(null);
  const recognitionRef = useRef(null);
  const onCommandRef = useRef(onCommand);
  const isListeningAllowedRef = useRef(isListeningAllowed);
  const voiceInputEnabledRef = useRef(voiceInputEnabled);
  const speakingRef = useRef(false);
  const selectedVoiceNameRef = useRef(selectedVoiceName);
  const announcementIdRef = useRef(0);
  const recognitionActiveRef = useRef(false);
  const restartTimerRef = useRef(null);
  const restartAllowedRef = useRef(true);

  onCommandRef.current = onCommand;
  isListeningAllowedRef.current = isListeningAllowed;
  voiceInputEnabledRef.current = voiceInputEnabled;
  selectedVoiceNameRef.current = selectedVoiceName;

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
    if (restartTimerRef.current) {
      window.clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
    try {
      recognitionRef.current?.stop();
    } catch {
      // The browser throws when recognition is already stopped.
    }
    setVoiceStatus(voiceInputEnabledRef.current ? 'ready' : 'off');
  };

  const startListening = () => {
    if (
      !voiceInputEnabledRef.current
      || !isListeningAllowedRef.current
      || speakingRef.current
      || !recognitionRef.current
      || recognitionActiveRef.current
    ) return;
    try {
      setVoiceError('');
      setVoiceStatus('starting');
      recognitionRef.current.start();
    } catch {
      if (!recognitionActiveRef.current) setVoiceStatus('ready');
    }
  };

  const ensureRecognition = () => {
    if (!voiceSupported || recognitionRef.current) return recognitionRef.current;
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = configureRecognition(
      new Recognition(),
      window.navigator?.language || 'en-US',
    );
    recognition.onstart = () => {
      recognitionActiveRef.current = true;
      restartAllowedRef.current = true;
      setVoiceError('');
      setVoiceStatus('listening');
    };
    recognition.onaudiostart = () => setVoiceStatus('listening');
    recognition.onspeechstart = () => setVoiceStatus('hearing');
    recognition.onspeechend = () => setVoiceStatus('processing');
    recognition.onresult = (event) => {
      const result = getRecognitionResult(event);
      if (!result) return;
      setLastHeard(result.transcript);
      if (!result.isFinal) {
        setVoiceStatus('hearing');
        return;
      }
      setVoiceStatus(result.command ? 'heard' : 'listening');
      if (isListeningAllowedRef.current) onCommandRef.current?.(
        result.command || { type: 'unknown', transcript: result.transcript },
      );
    };
    recognition.onerror = (event) => {
      if (event.error === 'aborted' && (speakingRef.current || !voiceInputEnabledRef.current)) {
        return;
      }
      const failure = getRecognitionFailure(event.error);
      restartAllowedRef.current = failure.restartAllowed;
      setVoiceError(failure.message);
      setVoiceStatus(failure.status);
    };
    recognition.onnomatch = () => {
      setVoiceError('Speech was detected, but no blackjack command matched.');
      setVoiceStatus('error');
    };
    recognition.onend = () => {
      recognitionActiveRef.current = false;
      setVoiceStatus(current => (
        ['blocked', 'error'].includes(current) || !voiceInputEnabledRef.current ? current : 'ready'
      ));
      if (
        voiceInputEnabledRef.current
        && isListeningAllowedRef.current
        && !speakingRef.current
        && restartAllowedRef.current
      ) {
        restartTimerRef.current = window.setTimeout(startListening, 300);
      }
    };
    recognitionRef.current = recognition;
    return recognition;
  };

  const toggleVoiceInput = async () => {
    if (!voiceSupported) return;
    if (voiceInputEnabledRef.current) {
      voiceInputEnabledRef.current = false;
      restartAllowedRef.current = false;
      setVoiceInputEnabled(false);
      stopListening();
      return;
    }

    if (window.navigator?.mediaDevices?.getUserMedia) {
      try {
        const stream = await window.navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
      } catch {
        restartAllowedRef.current = false;
        setVoiceInputEnabled(false);
        setVoiceStatus('blocked');
        setVoiceError('Microphone access is blocked. Allow it in the browser site settings.');
        return false;
      }
    }

    ensureRecognition();
    voiceInputEnabledRef.current = true;
    restartAllowedRef.current = true;
    setVoiceInputEnabled(true);
    setVoiceError('');
    setVoiceStatus('ready');
    if (isListeningAllowedRef.current) startListening();
    return true;
  };

  const announce = (text, { listenAfter = false } = {}) => {
    if (typeof window === 'undefined') return;
    const announcementId = ++announcementIdRef.current;
    setLastAnnouncement(text);
    if (recognitionRef.current) stopListening();
    speakingRef.current = true;
    stopKokoroSpeech();

    let finished = false;
    let resolveAnnouncement;
    const announcementComplete = new Promise(resolve => {
      resolveAnnouncement = resolve;
    });
    const beginListening = () => {
      if (finished) return;
      finished = true;
      if (announcementId !== announcementIdRef.current) {
        resolveAnnouncement();
        return;
      }
      speakingRef.current = false;
      if (listenAfter) startListening();
      resolveAnnouncement();
    };

    if (!speechEnabled) {
      beginListening();
      return announcementComplete;
    }

    window.speechSynthesis?.cancel();
    const speakWithSystemVoice = () => {
      if (announcementId !== announcementIdRef.current) {
        beginListening();
        return;
      }
      if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) {
        beginListening();
        return;
      }
      const utterance = new window.SpeechSynthesisUtterance(text);
      const voice = availableVoices.find(item => item.name === selectedVoiceNameRef.current)
        || choosePreferredTableVoice(availableVoices);
      if (voice) utterance.voice = voice;
      utterance.rate = 0.88;
      utterance.pitch = 0.94;
      utterance.volume = 0.95;
      utterance.onend = beginListening;
      utterance.onerror = beginListening;
      window.speechSynthesis.speak(utterance);
    };

    if (selectedVoiceNameRef.current.startsWith('kokoro:')) {
      setVoiceModelStatus('loading');
      const kokoroSpeech = speakWithKokoro(
        text,
        selectedVoiceNameRef.current.replace('kokoro:', ''),
        progress => {
          if (progress?.status === 'progress') {
            setVoiceModelStatus('loading');
            setVoiceModelProgress(Math.round(progress.progress || 0));
          }
        },
      );
      const firstUseTimeout = new Promise((_, reject) => {
        window.setTimeout(() => reject(new Error('Kokoro is still warming up.')), 8000);
      });
      Promise.race([kokoroSpeech, firstUseTimeout])
        .then(() => {
          setVoiceModelStatus('ready');
          setVoiceModelProgress(100);
          beginListening();
        })
        .catch(() => {
          stopKokoroSpeech();
          setVoiceModelStatus('warming');
          speakWithSystemVoice();
        });
    } else {
      speakWithSystemVoice();
    }
    return announcementComplete;
  };

  useEffect(() => {
    if (!isListeningAllowed) {
      stopListening();
    } else if (voiceInputEnabledRef.current) {
      startListening();
    }
  }, [isListeningAllowed]);

  useEffect(() => {
    if (!window.speechSynthesis) return undefined;
    const refreshVoices = () => {
      const voices = window.speechSynthesis.getVoices()
        .filter(voice => voice.lang.toLowerCase().startsWith('en'))
        .sort((left, right) => scoreTableVoice(right) - scoreTableVoice(left));
      setAvailableVoices(voices);
      setSelectedVoiceName(current => (
        current || choosePreferredTableVoice(voices)?.name || ''
      ));
    };
    refreshVoices();
    window.speechSynthesis.addEventListener?.('voiceschanged', refreshVoices);
    return () => window.speechSynthesis.removeEventListener?.('voiceschanged', refreshVoices);
  }, []);

  useEffect(() => {
    if (selectedVoiceName) {
      window.localStorage.setItem('blackjack-dealer-voice', selectedVoiceName);
    }
  }, [selectedVoiceName]);

  useEffect(() => () => {
    if (restartTimerRef.current) window.clearTimeout(restartTimerRef.current);
    recognitionRef.current?.abort();
    window.speechSynthesis?.cancel();
    stopKokoroSpeech();
    audioContextRef.current?.close();
  }, []);

  return {
    announce,
    availableVoices,
    kokoroVoices: KOKORO_VOICES,
    lastAnnouncement,
    lastHeard,
    playSound,
    selectedVoiceName,
    setSoundEnabled,
    setSpeechEnabled,
    setSelectedVoiceName,
    soundEnabled,
    speechEnabled,
    toggleVoiceInput,
    voiceInputEnabled,
    voiceError,
    voiceModelProgress,
    voiceModelStatus,
    voiceStatus,
    voiceSupported,
  };
}
