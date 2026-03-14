// ProspectAI — Shared utility functions

export function fmtFunding(amt) {
  if (!amt) return '';
  const n = Number(amt);
  if (n >= 1e9) return '$' + (n / 1e9).toFixed(1) + 'B raised';
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M raised';
  if (n >= 1e3) return '$' + (n / 1e3).toFixed(0) + 'K raised';
  return '$' + n;
}

export function fmtAmt(amt) {
  if (!amt) return '';
  const n = Number(amt);
  if (isNaN(n)) { const s = String(amt).trim(); return s.startsWith('$') ? s : '$' + s; }
  if (n >= 1e9) return '$' + (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(0) + 'M';
  if (n >= 1e3) return '$' + (n / 1e3).toFixed(0) + 'K';
  return '$' + n;
}

export function fmtGrowth(g) {
  if (g === null || g === undefined || g === '') return '';
  const pct = Math.round(Number(g) * 100);
  return (pct >= 0 ? '+' : '') + pct + '% headcount (6mo)';
}

export function fmtTimeInRole(months) {
  if (months === null || months === undefined) return '';
  if (months < 1) return 'New hire';
  if (months < 12) return months + 'mo in role';
  return Math.floor(months / 12) + 'yr ' + (months % 12) + 'mo in role';
}

export function fmtRoundDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return months[dt.getMonth()] + ' ' + dt.getFullYear();
}

export function fmtRoundAmount(amt) {
  if (!amt) return '';
  const n = Number(amt);
  if (isNaN(n) || n <= 0) return '';
  if (n >= 1e9) return '$' + (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(0) + 'M';
  if (n >= 1e3) return '$' + (n / 1e3).toFixed(0) + 'K';
  return '$' + n;
}

export function fmtFollowers(n) {
  if (!n) return '';
  n = Number(n);
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M followers';
  if (n >= 1e3) return (n / 1e3).toFixed(0) + 'K followers';
  return n + ' followers';
}

// localStorage persistence helpers
export function paiSave(key, data) {
  try { localStorage.setItem('pai_' + key, JSON.stringify(data)); } catch(e) {}
}

export function paiLoad(key, fallback = null) {
  try {
    const raw = localStorage.getItem('pai_' + key);
    return raw ? JSON.parse(raw) : fallback;
  } catch(e) { return fallback; }
}

// Random page picker (avoids repeating pages per filter combo)
const _usedPages = {};
const _seenIds = new Set();

export function pickPage(filterKey, max = 30) {
  if (!_usedPages[filterKey]) _usedPages[filterKey] = new Set();
  const used = _usedPages[filterKey];
  if (used.size >= max) used.clear(); // reset when all exhausted
  let page;
  do { page = Math.floor(Math.random() * max) + 1; } while (used.has(page));
  used.add(page);
  return page;
}

export function addSeenIds(ids) {
  ids.forEach(id => _seenIds.add(id));
}

export function filterSeenIds(contacts) {
  return contacts.filter(c => !_seenIds.has(c.id));
}

export function makeFilterKey(state) {
  return JSON.stringify({
    t: state.selectedTitles,
    i: state.selectedIndustries,
    e: state.selectedEmployeeRanges,
    g: state.selectedLocations,
  });
}
