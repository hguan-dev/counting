import { KokoroTTS } from 'kokoro-js';

let modelPromise = null;
const audioPromises = new Map();

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
    const audioPromise = getModel(requestId)
      .then(model => model.generate(text, { voice, speed: 0.96 }))
      .then(rawAudio => rawAudio.toBlob())
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
    }
  } catch (error) {
    self.postMessage({
      error: error instanceof Error ? error.message : 'Kokoro voice generation failed.',
      id,
      type: 'error',
    });
  }
};
