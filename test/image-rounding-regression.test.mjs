import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveDimensions } from '../public/js/core/dimensions.mjs';

// Fixed external GQ-01 cases: exact positive half pixels must round up.
const cases = [
  [22, 11, 'width', '15', 15, 8],
  [22, 55, 'width', '3', 3, 8],
  [28, 42, 'width', '17', 17, 26],
  [26, 13, 'width', '15', 15, 8],
  [30, 75, 'width', '11', 11, 28],
  [30, 45, 'width', '21', 21, 32],
  [11, 22, 'height', '15', 8, 15],
  [22, 11, 'long-edge', '15', 15, 8],
];

for (const [width, height, mode, value, expectedWidth, expectedHeight] of cases) {
  test(`GQ-01 exact half-up ${width}x${height} ${mode}=${value}`, () => {
    assert.deepEqual(deriveDimensions({ width, height, mode, value }), {
      ok: true, value: { width: expectedWidth, height: expectedHeight },
    });
  });
}
