// RaffleMint — verifiable raffle logic (pure functions, no DOM, no browser globals)
// Deterministic seeded PRNG: mulberry32
export function hashSeed(str) {
  // FNV-1a 32-bit
  let h = 0x811c9dc5;
  const s = String(str ?? '');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function drawWinners(participants, count, seed) {
  const pool = [...new Set((participants || []).map(String))].filter(Boolean);
  const n = Math.max(0, Math.min(count | 0, pool.length));
  if (!n) return [];
  const rand = mulberry32(hashSeed(seed));
  const arr = pool.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, n);
}

export function ticketNumber(index, total) {
  const width = String(Math.max(1, total | 0)).length;
  return `#${String((index | 0) + 1).padStart(width, '0')}`;
}

export function oddsFor(participants, entriesPerPerson = 1) {
  const p = (participants || []).length;
  if (!p) return { percent: 0, oneIn: Infinity, text: '—' };
  const e = Math.max(1, entriesPerPerson | 0);
  const oneIn = p / Math.min(e, p);
  const percent = (Math.min(e, p) / p) * 100;
  return {
    percent: Math.round(percent * 10) / 10,
    oneIn,
    text: `1 in ${oneIn % 1 ? oneIn.toFixed(1) : oneIn}`,
  };
}

const CURRENCY_META = {
  USD: { decimals: 2, symbol: '$' },
  EUR: { decimals: 2, symbol: '€' },
  GBP: { decimals: 2, symbol: '£' },
  BRL: { decimals: 2, symbol: 'R$' },
  JPY: { decimals: 0, symbol: '¥' },
};

export function formatMoney(cents, currency = 'USD', locale = 'en-US') {
  const meta = CURRENCY_META[currency] || CURRENCY_META.USD;
  const value = cents / 10 ** meta.decimals;
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: meta.decimals,
      maximumFractionDigits: meta.decimals,
    }).format(value);
  } catch {
    return `${meta.symbol} ${value.toFixed(meta.decimals)}`;
  }
}

export function parsePriceToCents(input) {
  const s = String(input ?? '').trim();
  if (!s) return NaN;
  let t = s.replace(/[^\d.,-]/g, '');
  if (!t) return NaN;
  const lastC = t.lastIndexOf(','), lastD = t.lastIndexOf('.');
  if (lastC > -1 && lastD > -1) {
    t = lastC > lastD ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '');
  } else if (lastC > -1) {
    t = /,\d{1,2}$/.test(t) ? t.replace(',', '.') : t.replace(/,/g, '');
  }
  const v = Number(t);
  return Number.isFinite(v) ? Math.round(v * 100) : NaN;
}

export function buildShareLink(baseUrl, raffleData) {
  const json = JSON.stringify(raffleData);
  const b64 = btoa(unescape(encodeURIComponent(json)));
  const clean = baseUrl.replace(/\/+$/, '');
  return `${clean}/?d=${b64}`;
}

export function readShareLink(search) {
  try {
    const m = /[?&]d=([^&]+)/.exec(String(search || ''));
    if (!m) return null;
    const json = decodeURIComponent(escape(atob(decodeURIComponent(m[1]))));
    const obj = JSON.parse(json);
    return typeof obj === 'object' && obj !== null ? obj : null;
  } catch {
    return null;
  }
}

export function normalizeList(raw) {
  return [...new Set(String(raw ?? '')
    .split(/[\n;,]+/)
    .map((s) => s.trim())
    .filter(Boolean))];
}
