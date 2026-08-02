import { execFile } from 'node:child_process';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { KokoroTTS } from 'kokoro-js';
import { HEART_TABLE_PHRASES } from '../src/utils/heartVoicePhrases.js';

const run = promisify(execFile);
const outputDirectory = new URL('../public/audio/heart/', import.meta.url);
await mkdir(outputDirectory, { recursive: true });

const tts = await KokoroTTS.from_pretrained(
  'onnx-community/Kokoro-82M-v1.0-ONNX',
  { device: 'cpu', dtype: 'q8' },
);

for (let index = 0; index < HEART_TABLE_PHRASES.length; index += 1) {
  const phrase = HEART_TABLE_PHRASES[index];
  const audio = await tts.generate(phrase, { speed: 0.96, voice: 'af_heart' });
  const basename = String(index).padStart(3, '0');
  const wavFile = new URL(`${basename}.wav`, outputDirectory);
  const mp3File = new URL(`${basename}.mp3`, outputDirectory);
  await writeFile(wavFile, new Uint8Array(audio.toWav()));
  await run('ffmpeg', [
    '-loglevel', 'error',
    '-y',
    '-i', wavFile.pathname,
    '-codec:a', 'libmp3lame',
    '-b:a', '48k',
    mp3File.pathname,
  ]);
  await unlink(wavFile);
  console.log(`${index + 1}/${HEART_TABLE_PHRASES.length} ${phrase}`);
}

await writeFile(
  new URL('manifest.json', outputDirectory),
  `${JSON.stringify({ phrases: HEART_TABLE_PHRASES, voice: 'af_heart' }, null, 2)}\n`,
);
