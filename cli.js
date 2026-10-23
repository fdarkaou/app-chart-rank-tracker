#!/usr/bin/env node
// Competitor chart rank tracker on the PeekPanda API. Node 18+, no dependencies.
import { readFile } from 'node:fs/promises';
import { summarise, toMarkdown, toCsv, movers } from './track.js';

const HELP = `Usage:
  PEEKPANDA_TOKEN=... node cli.js <storeId> [storeId ...] [options]
  node cli.js --file a.json [--file b.json ...] [options]

Options:
  --country <cc>         Apple storefront (default us)
  --category <id|all>    Apple category id or all (default all)
  --chart <type>         free | paid | grossing (default free)
  --limit <n>            history points per app, 1-100 (default 30)
  --window <days>        movement window column (default 7)
  --format md|csv|json   output format (default md)
  --alert <n>            print only apps that moved >= n places since the previous point; exit 0
  --slack-webhook <url>  also POST the alert lines to a Slack incoming webhook (use with --alert)
  --tenancy <value>      x-genviral-tenancy header (default personal)
  --api <url>            API base (default https://api.peekpanda.com)
  --file <path>          read a saved chart history JSON instead of calling the API`;

function parse(argv) {
  const o = { country: 'us', category: 'all', chart: 'free', limit: 30, window: 7, format: 'md', tenancy: 'personal', api: 'https://api.peekpanda.com', files: [], ids: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const v = () => argv[++i];
    if (a === '-h' || a === '--help') o.help = true;
    else if (a === '--file') o.files.push(v());
    else if (a === '--alert') o.alert = Number(v());
    else if (a === '--slack-webhook') o.slack = v();
    else if (a.startsWith('--')) o[a.slice(2)] = v();
    else o.ids.push(a);
  }
  return o;
}

async function fetchHistory(o, storeId) {
  if (!/^\d+$/.test(storeId)) throw new Error(`storeId must be numeric, got "${storeId}"`);
  const token = process.env.PEEKPANDA_TOKEN;
  if (!token) throw new Error('Set PEEKPANDA_TOKEN to a PeekPanda API key (Account → API keys). Never commit it.');
  const url = new URL(`/v1/charts/apps/${storeId}/history`, o.api);
  url.search = new URLSearchParams({ country: o.country, categoryId: o.category, chartType: o.chart, limit: String(o.limit) });
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, 'x-genviral-tenancy': o.tenancy, Accept: 'application/json' } });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const retry = res.headers.get('retry-after');
    throw new Error(`PeekPanda API ${res.status} ${body?.error?.code ?? ''} for ${storeId}: ${body?.error?.message ?? res.statusText}${retry ? ` (retry after ${retry}s)` : ''}`);
  }
  return res.json();
}

async function main() {
  const o = parse(process.argv.slice(2));
  if (o.help || (!o.ids.length && !o.files.length)) { console.log(HELP); return; }
  const responses = [];
  for (const f of o.files) responses.push(JSON.parse(await readFile(f, 'utf8')));
  for (const id of o.ids) responses.push(await fetchHistory(o, id)); // sequential: friendly to rate limits
  const rows = responses.map((r) => summarise(r, { movedWindow: Number(o.window) }));

  if (Number.isFinite(o.alert)) {
    const lines = movers(rows, o.alert);
    if (lines.length) console.log(lines.join('\n'));
    if (lines.length && o.slack) {
      const res = await fetch(o.slack, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: `Chart movers (${o.chart}, ${o.country}):\n${lines.join('\n')}` }) });
      if (!res.ok) throw new Error(`Slack webhook returned ${res.status}`);
    }
    return;
  }
  if (o.format === 'json') console.log(JSON.stringify(rows, null, 2));
  else if (o.format === 'csv') console.log(toCsv(rows));
  else console.log(toMarkdown(rows, { movedWindow: Number(o.window) }));
}

main().catch((e) => { console.error(e.message); process.exit(1); });
