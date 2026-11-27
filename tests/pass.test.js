// Run from the project folder: node tests/pass.test.js
const assert = require('assert');
const { passClaims, resetOf } = require('../pass.js');

const now = Date.parse('2026-11-27T19:40:00+08:00');
const end = Date.parse('2026-12-23T23:59:00+08:00');
const one = (purchase, renewal = null) => ({ purchase, renewal });

// Examples from the design discussion, counted from 27 Nov 19:40 to the banner end.
assert.strictEqual(passClaims(now, end, one(null)), 0, 'no pass');
assert.strictEqual(passClaims(now, end, one('2026-11-27')), 26, 'example B: bought today');
assert.strictEqual(passClaims(now, end, one('2026-11-20')), 22, 'example C: bought 20 Nov');
assert.strictEqual(passClaims(now, end, one('2026-11-05')), 7, 'example D: bought 5 Nov');

// A single server day: the app uses this to show whether the pass was active on an entry's date.
const day = (d) => [resetOf(d) - 1, resetOf(d)];
assert.strictEqual(passClaims(...day('2026-12-04'), one('2026-11-05')), 1, 'last day of a 5 Nov pass');
assert.strictEqual(passClaims(...day('2026-12-05'), one('2026-11-05')), 0, 'day after it ends');

// TODO(you): renewal case. Bought 5 Nov, renewed 5 Dec, counted from `now` to `end`.
// Work out the expected number by hand first, then uncomment and fill it in.
assert.strictEqual(passClaims(now, end, one('2026-11-05', '2026-12-05')), 26, 'renewal right after pass 1 ends');
assert.strictEqual(passClaims(now, end, one('2026-11-05', '2026-12-01')), 26, 'renewal overlapping pass 1');

console.log('pass.js: all checks passed');
