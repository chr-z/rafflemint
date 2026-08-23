// RaffleMint app: i18n + raffle editor + deterministic draw + share-in-URL + PWA boot.
import { drawWinners, ticketNumber, oddsFor, formatMoney, parsePriceToCents, normalizeList, buildShareLink, readShareLink } from './logic.js';

const LS_KEY = 'rafflemint.raffle.v1';

const state = {
  title: '',
  prize: '',
  prizeCost: '',
  currency: 'USD',
  participantsRaw: '',
  winnersCount: 1,
  seed: '',
};

let i18n = null;
const $ = (sel) => document.querySelector(sel);

function save() {
  localStorage.setItem(LS_KEY, JSON.stringify(state));
}

function loadState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) Object.assign(state, JSON.parse(raw));
  } catch { /* fresh */ }
}

function seedDemo() {
  Object.assign(state, {
    title: 'Mecha keyboard giveaway',
    prize: 'Custom keycap set',
    prizeCost: '129.90',
    currency: 'USD',
    participantsRaw: 'ana\nbruno\ncarla\ndiego\nelisa\nfelipe\ngio\nhugo\niris\njoana',
    winnersCount: 3,
    seed: 'live-2026-08-23',
  });
  save();
}

function money(cents) {
  const loc = document.documentElement.lang === 'pt-BR' ? 'pt-BR' : 'en-US';
  return formatMoney(cents, state.currency, loc);
}

function participants() {
  return normalizeList(state.participantsRaw);
}

let savedTimer = null;
function flashSaved() {
  $('#save-indicator').hidden = false;
  clearTimeout(savedTimer);
  savedTimer = setTimeout(() => { $('#save-indicator').hidden = true; }, 1200);
}

function syncFromDom() {
  state.title = $('#f-title').value;
  state.prize = $('#f-prize').value;
  state.prizeCost = $('#f-cost').value;
  state.currency = $('#f-currency').value;
  state.participantsRaw = $('#f-participants').value;
  state.winnersCount = Math.max(1, Number($('#f-count').value) || 1);
  state.seed = $('#f-seed').value;
  save();
  updateStats();
  flashSaved();
}

function fillForm() {
  $('#f-title').value = state.title;
  $('#f-prize').value = state.prize;
  $('#f-cost').value = state.prizeCost;
  $('#f-currency').value = state.currency;
  $('#f-participants').value = state.participantsRaw;
  $('#f-count').value = state.winnersCount;
  $('#f-seed').value = state.seed;
}

function updateStats() {
  const pool = participants();
  $('#rv-pool').textContent = String(pool.length);
  const costCents = parsePriceToCents(state.prizeCost);
  $('#rv-prize').textContent = Number.isFinite(costCents) && costCents > 0 ? money(costCents) : '—';
  if (!lastWinners.length) {
    $('#rv-odds').textContent = oddsFor(pool).text;
  }
}

let lastWinners = [];
let lastSeedUsed = '';

function renderResult(winners, seedUsed) {
  lastWinners = winners;
  lastSeedUsed = seedUsed;
  const list = $('#rv-winners');
  list.innerHTML = '';
  const total = participants().length;
  for (let i = 0; i < winners.length; i++) {
    const li = document.createElement('li');
    li.textContent = `${ticketNumber(i, winners.length)} ${winners[i]}`;
    list.appendChild(li);
  }
  $('#rv-empty').hidden = winners.length > 0;
  $('#rv-seed').textContent = seedUsed || '—';
  const odds = oddsFor(participants());
  $('#rv-odds').textContent = odds.text;
}

function proofText() {
  return [
    `🎲 ${state.title || 'Raffle'} — ${i18n ? i18n.t('result.winners') : 'Winner(s)'}`,
    state.prize ? `${state.prize}${state.prizeCost ? ` (${money(parsePriceToCents(state.prizeCost))})` : ''}` : '',
    `seed: ${lastSeedUsed}`,
    `pool: ${participants().length}`,
    ...lastWinners.map((w, i) => `${ticketNumber(i, lastWinners.length)} ${w}`),
    '—',
    'Replay: https://chr-z.github.io/rafflemint/ with the same list + seed.',
  ].filter(Boolean).join('\n');
}

async function copyText(text, btn, okKey) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    prompt('Copy:', text);
  }
  const old = btn.textContent;
  btn.textContent = i18n ? i18n.t(okKey) : 'Copied!';
  setTimeout(() => { btn.textContent = old; }, 1500);
}

function drawNow() {
  const pool = participants();
  const seedStr = `${state.seed}|${state.winnersCount}`;
  const winners = drawWinners(pool, state.winnersCount, seedStr);
  renderResult(winners, state.seed);
  syncFromDom();
}

function shareUrl() {
  const base = location.origin + location.pathname.replace(/index\.html$/, '');
  return buildShareLink(base, {
    title: state.title,
    prize: state.prize,
    prizeCost: state.prizeCost,
    currency: state.currency,
    participants: participants(),
    winnersCount: state.winnersCount,
    seed: state.seed,
  });
}

function exportJson() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'rafflemint-raffle.json';
  a.click();
  URL.revokeObjectURL(a.href);
}

function importJson(file) {
  const r = new FileReader();
  r.onload = () => {
    try {
      Object.assign(state, JSON.parse(String(r.result)));
      fillForm();
      save();
      updateStats();
    } catch { alert('Invalid JSON'); }
  };
  r.readAsText(file);
}

function wireEvents() {
  ['#f-title', '#f-prize', '#f-cost', '#f-currency', '#f-participants', '#f-count', '#f-seed'].forEach((sel) => {
    $(sel).addEventListener('input', syncFromDom);
    $(sel).addEventListener('change', syncFromDom);
  });
  $('#btn-draw').addEventListener('click', drawNow);
  $('#btn-share').addEventListener('click', async () => copyText(shareUrl(), $('#btn-share'), 'form.copied'));
  $('#btn-proof').addEventListener('click', () => copyText(proofText(), $('#btn-proof'), 'result.copiedResults'));
  $('#btn-export').addEventListener('click', exportJson);
  $('#btn-import').addEventListener('change', (e) => e.target.files[0] && importJson(e.target.files[0]));
}

async function boot() {
  const shared = /[?&]d=/.test(location.search) ? readShareLink(location.search) : null;
  if (shared) {
    Object.assign(state, {
      title: shared.title || '',
      prize: shared.prize || '',
      prizeCost: shared.prizeCost || '',
      currency: shared.currency || 'USD',
      participantsRaw: (shared.participants || []).join('\n'),
      winnersCount: shared.winnersCount || 1,
      seed: shared.seed || '',
    });
    // auto-draw so the visitor sees the verified result immediately
    setTimeout(drawNow, 400);
  } else {
    loadState();
    if (!localStorage.getItem(LS_KEY)) seedDemo();
  }
  i18n = await import('./i18n.js');
  await i18n.initLanguage();
  fillForm();
  wireEvents();
  updateStats();
}

window.__rmReady = boot();
