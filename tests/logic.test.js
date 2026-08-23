import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hashSeed, mulberry32, drawWinners, ticketNumber, oddsFor,
  formatMoney, parsePriceToCents, buildShareLink, readShareLink, normalizeList,
} from '../js/logic.js';

test('hashSeed is deterministic and order-sensitive', () => {
  assert.equal(hashSeed('rafflemint|v1'), hashSeed('rafflemint|v1'));
  assert.notEqual(hashSeed('a,b,c'), hashSeed('c,b,a'));
  assert.equal(typeof hashSeed('x'), 'number');
});

test('drawWinners is fully deterministic for same seed', () => {
  const p = ['ana', 'bruno', 'carla', 'diego', 'elisa', 'felipe'];
  const a = drawWinners(p, 2, 'my-stream-2026');
  const b = drawWinners(p, 2, 'my-stream-2026');
  assert.deepEqual(a, b);
});

test('different seed yields different result (usually)', () => {
  const p = Array.from({ length: 50 }, (_, i) => `user${i}`);
  const a = drawWinners(p, 5, 'seed-A');
  const b = drawWinners(p, 5, 'seed-B');
  assert.notDeepEqual(a, b);
});

test('drawWinners respects count and never repeats a winner', () => {
  const p = ['a', 'b', 'c', 'd', 'e'];
  const w = drawWinners(p, 3, 's');
  assert.equal(w.length, 3);
  assert.equal(new Set(w).size, 3);
});

test('drawWinners clamps count to pool size and handles empty', () => {
  assert.equal(drawWinners(['a'], 5, 's').length, 1);
  assert.deepEqual(drawWinners([], 3, 's'), []);
  assert.deepEqual(drawWinners(['a', 'b'], 0, 's'), []);
});

test('drawWinners dedupes participants before drawing', () => {
  const w = drawWinners(['ana', 'ana', 'ANA ', 'bruno'], 2, 's');
  assert.equal(new Set(w.map((x) => x.toLowerCase())).size, w.length);
});

test('ticketNumber zero-pads by pool size', () => {
  assert.equal(ticketNumber(0, 150), '#001');
  assert.equal(ticketNumber(41, 100), '#042');
  assert.equal(ticketNumber(9, 10), '#10');
});

test('oddsFor computes percent and one-in text', () => {
  assert.equal(oddsFor(['a', 'b', 'c', 'd']).percent, 25);
  assert.equal(oddsFor([]).text, '—');
  const o = oddsFor(Array.from({ length: 10 }, (_, i) => i));
  assert.equal(o.text, '1 in 10');
});

test('formatMoney is currency/locale parametrized (global-first)', () => {
  assert.match(formatMoney(4990, 'USD', 'en-US'), /\$49\.90/);
  assert.match(formatMoney(4990, 'BRL', 'pt-BR'), /R\$\s?49,90/);
  assert.match(formatMoney(4990, 'EUR', 'de-DE'), /49,90\s?€/);
  assert.doesNotMatch(formatMoney(4990, 'USD', 'en-US'), /R\$/);
  assert.ok(formatMoney(100, 'ZZZ', 'en-US').length > 0);
});

test('parsePriceToCents accepts en and pt-BR formats', () => {
  assert.equal(parsePriceToCents('49.90'), 4990);
  assert.equal(parsePriceToCents('1.234,56'), 123456);
  assert.equal(parsePriceToCents('1,234.56'), 123456);
  assert.equal(parsePriceToCents('R$ 20'), 2000);
  assert.ok(Number.isNaN(parsePriceToCents('abc')));
});

test('share link round-trips the raffle payload', () => {
  const data = { title: 'Giveaway', prize: 'Keyboard', participants: ['a', 'b'] };
  const url = buildShareLink('https://chr-z.github.io/rafflemint/', data);
  assert.ok(url.includes('?d='));
  assert.deepEqual(readShareLink(new URL(url).search), data);
});

test('readShareLink returns null on garbage or empty', () => {
  assert.equal(readShareLink('?d=%%%'), null);
  assert.equal(readShareLink(''), null);
});
