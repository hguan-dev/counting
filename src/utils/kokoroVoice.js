export const KOKORO_VOICES = [
  { id: 'af_heart', label: 'Heart · American · A grade' },
  { id: 'af_bella', label: 'Bella · American · A− grade' },
  { id: 'bf_emma', label: 'Emma · British · B− grade' },
  { id: 'am_fenrir', label: 'Fenrir · American · male' },
];

let modelPromise = null;
let activeAudio = null;
let activeObjectUrl = null;
let activeResolve = null;
let speechRun = 0;

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

const getModel = (onProgress) => {
  if (!modelPromise) {
    modelPromise = import('kokoro-js').then(({ KokoroTTS }) => (
      KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', {
        dtype: 'q8',
        device: 'wasm',
        progress_callback: onProgress,
      })
    ));
  }
  return modelPromise;
};

export const stopKokoroSpeech = () => {
  speechRun += 1;
  cleanUpAudio();
};

export const speakWithKokoro = async (text, voice, onProgress) => {
  cleanUpAudio();
  const currentRun = ++speechRun;
  const model = await getModel(onProgress);
  if (currentRun !== speechRun) return;
  const rawAudio = await model.generate(text, { voice, speed: 0.96 });
  if (currentRun !== speechRun) return;
  const objectUrl = URL.createObjectURL(rawAudio.toBlob());
  const audio = new Audio(objectUrl);
  activeAudio = audio;
  activeObjectUrl = objectUrl;

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
