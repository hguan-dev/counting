import { KokoroTTS } from 'kokoro-js';

let modelPromise = null;
let generationQueue = Promise.resolve();
const audioPromises = new Map();
const AUDIO_CACHE = 'blackjack-kokoro-heart-v1';

const getCacheRequest = (voice, text) => (
  new Request(`https://blackjack-audio.local/${voice}/${encodeURIComponent(text)}`)
);

const getManifestRequest = voice => (
  new Request(`https://blackjack-audio.local/${voice}/__preload-complete__`)
);

const readPersistentAudio = async (voice, text) => {
  if (!self.caches) return null;
  const cache = await self.caches.open(AUDIO_CACHE);
  const response = await cache.match(getCacheRequest(voice, text));
  return response?.blob() || null;
};

const persistAudio = async (voice, text, blob) => {
  if (!self.caches) return;
  const cache = await self.caches.open(AUDIO_CACHE);
  await cache.put(
    getCacheRequest(voice, text),
    new Response(blob, { headers: { 'Content-Type': blob.type || 'audio/wav' } }),
  );
};

const hasPreloadManifest = async (voice, phraseCount) => {
  if (!self.caches) return false;
  const cache = await self.caches.open(AUDIO_CACHE);
  const response = await cache.match(getManifestRequest(voice));
  if (!response) return false;
  const manifest = await response.json();
  return manifest.phraseCount === phraseCount;
};

const persistPreloadManifest = async (voice, phraseCount) => {
  if (!self.caches) return;
  const cache = await self.caches.open(AUDIO_CACHE);
  await cache.put(
    getManifestRequest(voice),
    new Response(JSON.stringify({ phraseCount })),
  );
};

const getModel = (requestId) => {
  if (!modelPromise) {
    modelPromise = KokoroTTS.from_pretrained(
      'onnx-community/Kokoro-82M-v1.0-ONNX',
      {
        dtype: 'q8',
        device: 'wasm',
        progress_callback: progress => {
          self.postMessage({ id: requestId, progress, type: 'progress' });
        },
      },
    );
  }
  return modelPromise;
};

const getAudioBlob = async (requestId, text, voice) => {
  const cacheKey = `${voice}:${text}`;
  if (!audioPromises.has(cacheKey)) {
    const audioPromise = readPersistentAudio(voice, text)
      .then(cachedAudio => {
        if (cachedAudio) return cachedAudio;
        const generatedAudio = generationQueue.then(async () => {
          const model = await getModel(requestId);
          const rawAudio = await model.generate(text, { voice, speed: 0.96 });
          const blob = rawAudio.toBlob();
          await persistAudio(voice, text, blob);
          return blob;
        });
        generationQueue = generatedAudio.catch(() => undefined);
        return generatedAudio;
      })
      .catch(error => {
        audioPromises.delete(cacheKey);
        throw error;
      });
    audioPromises.set(cacheKey, audioPromise);
  }
  return audioPromises.get(cacheKey);
};

self.onmessage = async (event) => {
  const { id, text, type, voice } = event.data;
  try {
    if (type === 'load') {
      await getModel(id);
      self.postMessage({ id, type: 'complete' });
      return;
    }

    if (type === 'generate') {
      const blob = await getAudioBlob(id, text, voice);
      const buffer = await blob.arrayBuffer();
      self.postMessage(
        { buffer, id, mimeType: blob.type || 'audio/wav', type: 'audio' },
        [buffer],
      );
      return;
    }

    if (type === 'preload') {
      const phrases = [...new Set(event.data.phrases)];
      if (await hasPreloadManifest(voice, phrases.length)) {
        self.postMessage({
          id,
          progress: {
            completed: phrases.length,
            status: 'preparing',
            total: phrases.length,
          },
          type: 'progress',
        });
        self.postMessage({ id, type: 'complete' });
        return;
      }
      let completed = 0;
      await Promise.all(phrases.map(async phrase => {
        await getAudioBlob(id, phrase, voice);
        completed += 1;
        self.postMessage({
          id,
          progress: {
            completed,
            status: 'preparing',
            total: phrases.length,
          },
          type: 'progress',
        });
      }));
      await persistPreloadManifest(voice, phrases.length);
      self.postMessage({ id, type: 'complete' });
    }
  } catch (error) {
    self.postMessage({
      error: error instanceof Error ? error.message : 'Kokoro voice generation failed.',
      id,
      type: 'error',
    });
  }
};
