export const KOKORO_VOICES = [
  { id: 'af_heart', label: 'Heart · American · A grade' },
  { id: 'af_bella', label: 'Bella · American · A− grade' },
  { id: 'bf_emma', label: 'Emma · British · B− grade' },
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
    const audioPromise = requestWorker('generate', { text, voice })
      .then(result => new Blob([result.buffer], { type: result.mimeType }))
      .catch(error => {
        audioBlobPromises.delete(cacheKey);
        throw error;
      });
    audioBlobPromises.set(cacheKey, audioPromise);
  }
  return audioBlobPromises.get(cacheKey);
};

export const preloadKokoroVoice = async (voice, phrases, onProgress) => {
  await getModel(onProgress);
  const uniquePhrases = [...new Set(phrases)];
  for (let index = 0; index < uniquePhrases.length; index += 1) {
    await getAudioBlob(uniquePhrases[index], voice);
    onProgress?.({
      completed: index + 1,
      status: 'preparing',
      total: uniquePhrases.length,
    });
  }
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
  const audioBlob = await getAudioBlob(text, voice);
  if (currentRun !== speechRun) return;
  const objectUrl = URL.createObjectURL(audioBlob);
  const audio = new Audio(objectUrl);
  activeAudio = audio;
  activeObjectUrl = objectUrl;
  onAudioStart?.();

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
};
