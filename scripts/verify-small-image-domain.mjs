import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { deriveDimensions } from '../public/js/core/dimensions.mjs';

// Independent oracle: BigInt quotient/remainder, not the production formula.
function reference(size, edge, basis) {
  const numerator = BigInt(size) * BigInt(edge);
  const denominator = BigInt(basis);
  const quotient = numerator / denominator;
  const remainder = numerator % denominator;
  return Math.max(1, Number(quotient + (remainder * 2n >= denominator ? 1n : 0n)));
}

const source = await readFile(new URL('../public/js/core/dimensions.mjs', import.meta.url));
const report = {
  node: process.version,
  sourceFile: 'public/js/core/dimensions.mjs',
  sourceSha256: createHash('sha256').update(source).digest('hex'),
  domain: { width: [1, 64], height: [1, 64], modes: ['width', 'height', 'long-edge'], targets: '1..basis' },
  total: 0, pass: 0, fail: 0, examples: [],
};

for (let width = 1; width <= 64; width++) {
  for (let height = 1; height <= 64; height++) {
    for (const mode of report.domain.modes) {
      const basis = mode === 'width' ? width : mode === 'height' ? height : Math.max(width, height);
      for (let edge = 1; edge <= basis; edge++) {
        const input = { width, height, mode, value: String(edge) };
        const expected = { width: reference(width, edge, basis), height: reference(height, edge, basis) };
        const actual = deriveDimensions(input);
        report.total++;
        if (actual.ok && actual.value.width === expected.width && actual.value.height === expected.height) report.pass++;
        else {
          report.fail++;
          if (report.examples.length < 20) report.examples.push({ input, expected, actual });
        }
      }
    }
  }
}
report.status = report.total === 443_040 && report.fail === 0 ? 'PASS' : 'FAIL';
console.log(JSON.stringify(report, null, 2));
process.exitCode = report.status === 'PASS' ? 0 : 1;
