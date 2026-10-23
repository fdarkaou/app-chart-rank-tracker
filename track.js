// Summarise PeekPanda chart history responses into a competitor rank table.
// Pure functions, no I/O, so the CLI and the browser page share them.

export function summarise(resp, { movedWindow = 7 } = {}) {
  const history = (resp?.history ?? [])
    .filter((p) => p && typeof p.day === 'string')
    .sort((a, b) => a.day.localeCompare(b.day));
  const ranked = history.filter((p) => Number.isFinite(p.rank));
  const name = resp?.app?.name ?? resp?.storeId ?? 'unknown';
  const base = { storeId: String(resp?.storeId ?? ''), name, query: resp?.query ?? {}, points: ranked.length };
  if (!ranked.length) return { ...base, status: 'not_charted' };

  const latest = ranked[ranked.length - 1];
  const prev = ranked.length > 1 ? ranked[ranked.length - 2] : null;
  const cutoff = shiftDay(latest.day, -movedWindow);
  const windowStart = ranked.find((p) => p.day >= cutoff) ?? latest;
  const ranks = ranked.map((p) => p.rank);
  return {
    ...base,
    status: 'charted',
    latest: latest.rank,
    latestDay: latest.day,
    // Positive change = moved up the chart (rank number went down).
    change: prev ? prev.rank - latest.rank : null,
    changeWindow: windowStart !== latest ? windowStart.rank - latest.rank : null,
    best: Math.min(...ranks),
    worst: Math.max(...ranks),
    firstDay: ranked[0].day,
    gaps: countGaps(ranked),
  };
}

function shiftDay(day, n) {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Days between first and last observation with no stored rank.
function countGaps(ranked) {
  let gaps = 0;
  for (let i = 1; i < ranked.length; i++) {
    const days = Math.round((Date.parse(ranked[i].day) - Date.parse(ranked[i - 1].day)) / 86400000);
    if (days > 1) gaps += days - 1;
  }
  return gaps;
}

const arrow = (n) => (n == null ? '–' : n > 0 ? `▲${n}` : n < 0 ? `▼${-n}` : '=');

export function toMarkdown(rows, { movedWindow = 7 } = {}) {
  const sorted = [...rows].sort((a, b) => (a.latest ?? Infinity) - (b.latest ?? Infinity));
  const q = rows[0]?.query ?? {};
  const out = [
    `Chart: ${q.chartType ?? 'free'} · storefront ${q.country ?? 'us'} · category ${q.categoryId ?? 'all'}`,
    '',
    `| App | Rank | Day | vs prev | ${movedWindow}d | Best | Worst | Since | Gap days |`,
    '| --- | ---: | --- | ---: | ---: | ---: | ---: | --- | ---: |',
  ];
  for (const r of sorted) {
    if (r.status !== 'charted') {
      out.push(`| ${r.name} | not in chart | – | – | – | – | – | – | – |`);
      continue;
    }
    out.push(`| ${r.name} | ${r.latest} | ${r.latestDay} | ${arrow(r.change)} | ${arrow(r.changeWindow)} | ${r.best} | ${r.worst} | ${r.firstDay} | ${r.gaps} |`);
  }
  return out.join('\n');
}

export function toCsv(rows) {
  const head = ['storeId', 'name', 'status', 'latest', 'latestDay', 'change', 'changeWindow', 'best', 'worst', 'firstDay', 'gaps', 'points'];
  const esc = (v) => (v == null ? '' : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
  return [head.join(','), ...rows.map((r) => head.map((k) => esc(r[k])).join(','))].join('\n');
}

// Short alert lines for apps that moved at least `threshold` places since the previous point.
export function movers(rows, threshold = 5) {
  return rows
    .filter((r) => r.status === 'charted' && r.change != null && Math.abs(r.change) >= threshold)
    .map((r) => `${r.name}: ${r.change > 0 ? 'up' : 'down'} ${Math.abs(r.change)} to #${r.latest} (${r.latestDay})`);
}
