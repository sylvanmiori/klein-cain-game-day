import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('box-score extraction uses the verified multimodal model', () => {
  const workerSource = readFileSync(new URL('./worker.mjs', import.meta.url), 'utf8');
  assert.match(
    workerSource,
    /const BOXSCORE_VISION_MODEL = '@cf\/meta\/llama-4-scout-17b-16e-instruct';/,
  );
});
