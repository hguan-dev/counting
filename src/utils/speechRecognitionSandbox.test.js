import { describe, expect, test } from 'vitest';
import {
  configureRecognition,
  getRecognitionFailure,
  getRecognitionResult,
} from './tableSpeech';

const COMMAND_CASES = [
  ['deal', { type: 'deal' }],
  ['hit me', { type: 'action', action: 'hit' }],
  ['stand', { type: 'action', action: 'stand' }],
  ['stan', { type: 'action', action: 'stand' }],
  ['stay', { type: 'action', action: 'stand' }],
  ["I'm good", { type: 'action', action: 'stand' }],
  ['good', { type: 'action', action: 'stand' }],
  ['double down', { type: 'action', action: 'double' }],
  ['face down', { type: 'action', action: 'doubleFaceDown' }],
  ['face up', { type: 'action', action: 'double' }],
  ['split', { type: 'action', action: 'split' }],
  ['resplit', { type: 'action', action: 'split' }],
  ['buy insurance', { type: 'insurance', buy: true }],
  ['no insurance', { type: 'insurance', buy: false }],
  ['take even money', { type: 'evenMoney', accept: true }],
  ['play it out', { type: 'evenMoney', accept: false }],
  ['next round', { type: 'nextRound' }],
  ['next', { type: 'nextRound' }],
  ['run it', { type: 'runIt' }],
  ['running it', { type: 'runIt' }],
  ['reddit', { type: 'runIt' }],
  ['again', { type: 'runIt' }],
  ['stack it', { type: 'stackBet' }],
  ['stack it up', { type: 'stackAndRun' }],
  ['bang', { type: 'celebrate' }],
  ['baaannngg', { type: 'celebrate' }],
  ['good boy', { type: 'celebrate' }],
  ['fuck', { type: 'sickReaction' }],
  ['sickening', { type: 'sickReaction' }],
  ['bro', { type: 'sickReaction' }],
  ['bro are you serious', { type: 'sickReaction' }],
  ['are you serious', { type: 'sickReaction' }],
  ['seriously', { type: 'sickReaction' }],
  ['how sick', { type: 'sickReaction' }],
  ['how sick is that', { type: 'sickReaction' }],
  ['nah', { type: 'proceed' }],
  ['sorry', { type: 'cancel' }],
  ['my bad', { type: 'cancel' }],
  ['two spots bet twenty five and fifty', {
    type: 'configureBets',
    spotCount: 2,
    bets: [25, 50],
  }],
  ['reload five hundred dollars', { type: 'reload', amount: 500 }],
  ['what is my bankroll', { type: 'bankroll' }],
  ['hint', { type: 'tip' }],
  ['what is the true count', { type: 'count', enabled: true }],
  ['count off', { type: 'count', enabled: false }],
  ['microphone test', { type: 'micTest' }],
  ['sound off', { type: 'sound', enabled: false }],
  ['dealer voice on', { type: 'speech', enabled: true }],
  ['dealer voice off', { type: 'speech', enabled: false }],
  ['open the study guide', { type: 'studyGuide', open: true }],
  ['study guide off', { type: 'studyGuide', open: false }],
  ['full screen', { type: 'fullscreen', enabled: true }],
  ['exit full screen', { type: 'fullscreen', enabled: false }],
];

const recognitionEvent = (transcripts, isFinal = true) => {
  const result = transcripts.map(transcript => ({ transcript }));
  result.isFinal = isFinal;
  return { resultIndex: 0, results: [result] };
};

describe('speech recognition sandbox', () => {
  test('configures the browser recognizer for voice-mode command capture', () => {
    const fakeRecognition = {};
    expect(configureRecognition(fakeRecognition, 'en-GB')).toBe(fakeRecognition);
    expect(fakeRecognition).toMatchObject({
      continuous: true,
      interimResults: true,
      maxAlternatives: 5,
      lang: 'en-GB',
    });
  });

  test.each(COMMAND_CASES)('recognizes “%s”', (transcript, expectedCommand) => {
    expect(getRecognitionResult(recognitionEvent([transcript]))).toMatchObject({
      command: expectedCommand,
      isFinal: true,
      transcript,
    });
  });

  test('survives 1,000 alternating interim/final results and noisy first choices', () => {
    for (let turn = 0; turn < 1000; turn += 1) {
      const [transcript, expectedCommand] = COMMAND_CASES[turn % COMMAND_CASES.length];
      const interim = getRecognitionResult(recognitionEvent([transcript.slice(0, 4)], false));
      const final = getRecognitionResult(recognitionEvent(['unmatched background noise', transcript]));

      expect(interim.isFinal).toBe(false);
      expect(final).toMatchObject({
        command: expectedCommand,
        isFinal: true,
        transcript,
      });
    }
  });

  test('classifies recoverable and terminal recognition failures', () => {
    expect(getRecognitionFailure('no-speech')).toMatchObject({
      restartAllowed: true,
      status: 'error',
    });
    expect(getRecognitionFailure('not-allowed')).toMatchObject({
      restartAllowed: false,
      status: 'blocked',
    });
    expect(getRecognitionFailure('audio-capture')).toMatchObject({
      restartAllowed: false,
      status: 'blocked',
    });
    expect(getRecognitionFailure('network')).toMatchObject({
      restartAllowed: false,
      status: 'error',
    });
  });
});
