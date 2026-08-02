import { HEART_TABLE_PHRASES } from './heartVoicePhrases';

export const KOKORO_VOICES = [
  { id: 'af_heart', label: 'Heart · American · female' },
  { id: 'af_bella', label: 'Bella · American · female' },
  { id: 'bf_emma', label: 'Emma · British · female' },
  { id: 'am_fenrir', label: 'Fenrir · American · male' },
];

let workerInstance = null;
let modelPromise = null;
let activeAudio = null;
let activeObjectUrl = null;
let activeResolve = null;
let speechRun = 0;
let workerRequestId = 0;
const workerRequests = new Map();
const audioBlobPromises = new Map();
const heartAssetIndex = new Map(
  HEART_TABLE_PHRASES.map((phrase, index) => [phrase, String(index).padStart(3, '0')]),
);

const cleanUpAudio = () => {
  activeResolve?.();
  activeResolve = null;
  if (activeAudio) {
    activeAudio.pause();
    activeAudio.src = '';
    activeAudio = null;
  }
  if (activeObjectUrl) {
    URL.revokeObjectURL(activeObjectUrl);
    activeObjectUrl = null;
  }
};

const getWorker = () => {
  if (workerInstance) return workerInstance;
  workerInstance = new Worker(
    new URL('../workers/kokoro.worker.js', import.meta.url),
    { type: 'module' },
  );
  workerInstance.onmessage = (event) => {
    const request = workerRequests.get(event.data.id);
    if (!request) return;
    if (event.data.type === 'progress') {
      request.onProgress?.(event.data.progress);
      return;
    }
    workerRequests.delete(event.data.id);
    if (event.data.type === 'error') {
      request.reject(new Error(event.data.error));
    } else {
      request.resolve(event.data);
    }
  };
  workerInstance.onerror = () => {
    workerRequests.forEach(request => request.reject(new Error('Kokoro voice worker failed.')));
    workerRequests.clear();
  };
  return workerInstance;
};

const requestWorker = (type, payload = {}, onProgress) => new Promise((resolve, reject) => {
  const id = ++workerRequestId;
  workerRequests.set(id, { onProgress, reject, resolve });
  getWorker().postMessage({ ...payload, id, type });
});

const getModel = (onProgress) => {
  if (!modelPromise) {
    modelPromise = requestWorker('load', {}, onProgress);
  }
  return modelPromise;
};

export const preloadKokoro = (onProgress) => getModel(onProgress);

const getAudioBlob = (text, voice) => {
  const cacheKey = `${voice}:${text}`;
  if (!audioBlobPromises.has(cacheKey)) {
    const heartAsset = voice === 'af_heart' ? heartAssetIndex.get(text) : null;
    const audioRequest = heartAsset
      ? fetch(`${import.meta.env.BASE_URL}audio/heart/${heartAsset}.mp3`)
        .then(response => {
          if (!response.ok) throw new Error(`Heart audio asset ${heartAsset} is unavailable.`);
          return response.blob();
        })
      : requestWorker('generate', { text, voice })
        .then(result => new Blob([result.buffer], { type: result.mimeType }));
    const audioPromise = audioRequest
      .catch(error => {
        audioBlobPromises.delete(cacheKey);
        throw error;
      });
    audioBlobPromises.set(cacheKey, audioPromise);
  }
  return audioBlobPromises.get(cacheKey);
};

export const preloadKokoroVoice = async (voice, phrases, onProgress) => {
  if (voice === 'af_heart') {
    const uniquePhrases = [...new Set(phrases)];
    let completed = 0;
    await Promise.all(uniquePhrases.map(async phrase => {
      await getAudioBlob(phrase, voice);
      completed += 1;
      onProgress?.({
        completed,
        status: 'preparing',
        total: uniquePhrases.length,
      });
    }));
    return;
  }
  await getModel(onProgress);
  await requestWorker('preload', { phrases, voice }, onProgress);
};

export const stopKokoroSpeech = () => {
  speechRun += 1;
  cleanUpAudio();
};

export const speakWithKokoro = async (text, voice, onProgress, onAudioStart) => {
  cleanUpAudio();
  const currentRun = ++speechRun;
  await getModel(onProgress);
  if (currentRun !== speechRun) return;
  const phrases = (Array.isArray(text) ? text : [text]).filter(Boolean);
  let started = false;

  for (const phrase of phrases) {
    const audioBlob = await getAudioBlob(phrase, voice);
    if (currentRun !== speechRun) return;
    const objectUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(objectUrl);
    activeAudio = audio;
    activeObjectUrl = objectUrl;
    if (!started) {
      started = true;
      onAudioStart?.();
    }

    try {
      await new Promise((resolve, reject) => {
        activeResolve = resolve;
        audio.onended = resolve;
        audio.onerror = () => reject(new Error('Kokoro audio playback failed.'));
        audio.play().catch(reject);
      });
    } finally {
      if (currentRun === speechRun) {
        activeResolve = null;
        cleanUpAudio();
      }
    }
  }
};
