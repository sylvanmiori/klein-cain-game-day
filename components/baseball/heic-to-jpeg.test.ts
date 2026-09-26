import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  hasJpegMagic,
  isHeicLike,
  preferHeic2AnyFirst,
  MIN_JPEG_BYTES,
  MIN_JPEG_DIMENSION,
} from './heic-to-jpeg.ts';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '../..');

describe('isHeicLike', () => {
  it('detects heic/heif mime', () => {
    assert.equal(isHeicLike({ name: 'x.jpg', type: 'image/heic' }), true);
    assert.equal(isHeicLike({ name: 'x.jpg', type: 'image/heif' }), true);
    assert.equal(isHeicLike({ name: 'x.jpg', type: 'IMAGE/HEIC' }), true);
  });

  it('detects extension when type empty or generic', () => {
    assert.equal(isHeicLike({ name: 'IMG_7516.heic', type: '' }), true);
    assert.equal(isHeicLike({ name: 'shot.HEIF', type: 'application/octet-stream' }), true);
  });

  it('rejects ordinary jpeg/png', () => {
    assert.equal(isHeicLike({ name: 'box.jpg', type: 'image/jpeg' }), false);
    assert.equal(isHeicLike({ name: 'box.png', type: 'image/png' }), false);
  });
});

describe('hasJpegMagic', () => {
  it('accepts FF D8 FF', () => {
    assert.equal(hasJpegMagic(Uint8Array.of(0xff, 0xd8, 0xff, 0xe0)), true);
  });

  it('rejects short or non-jpeg', () => {
    assert.equal(hasJpegMagic(Uint8Array.of(0xff, 0xd8)), false);
    assert.equal(hasJpegMagic(Uint8Array.of(0x00, 0x00, 0x00)), false);
    assert.equal(hasJpegMagic(new Uint8Array(0)), false);
  });

  it('matches real example JPEGs', () => {
    const batting = readFileSync(join(root, 'content/baseball/examples/gamechanger-boxscore-batting.jpg'));
    assert.equal(hasJpegMagic(batting), true);
    assert.ok(batting.byteLength >= MIN_JPEG_BYTES);
  });
});

describe('preferHeic2AnyFirst', () => {
  it('true for Apple Safari UAs', () => {
    assert.equal(
      preferHeic2AnyFirst(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
      ),
      true,
    );
    assert.equal(
      preferHeic2AnyFirst(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
      ),
      true,
    );
  });

  it('false for Chrome/Firefox including iOS Chrome', () => {
    assert.equal(
      preferHeic2AnyFirst(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
      ),
      false,
    );
    assert.equal(
      preferHeic2AnyFirst(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/128.0.0.0 Mobile/15E148 Safari/604.1',
      ),
      false,
    );
  });
});

describe('constants', () => {
  it('dimension and size floors are sensible', () => {
    assert.ok(MIN_JPEG_DIMENSION >= 200);
    assert.ok(MIN_JPEG_BYTES >= 1000);
  });
});
