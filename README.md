# app-chart-rank-tracker

Track where your competitors sit in the App Store charts, day by day. Give it a list of App Store ids and it prints one table: latest rank, change since the previous day, change over the last week, best and worst position, and how many days are missing. It can also post a short Slack message when a rival jumps or drops.

Node 18+, no dependencies. There is also a [browser version](https://fdarkaou.github.io/app-chart-rank-tracker/) that works on pasted JSON and never sends it anywhere.

```
Chart: free · storefront us · category all

| App | Rank | Day | vs prev | 7d | Best | Worst | Since | Gap days |
| --- | ---: | --- | ---: | ---: | ---: | ---: | --- | ---: |
| Example Rival A | 4 | 2026-10-21 | ▲8 | ▲14 | 4 | 18 | 2026-10-14 | 1 |
| Example Rival B | 56 | 2026-10-21 | ▼1 | ▼16 | 40 | 56 | 2026-10-15 | 0 |
| Example Rival C | not in chart | – | – | – | – | – | – | – |
```

(Example data from `examples/`, not real apps.)

## Where the data comes from

The rank history comes from [PeekPanda](https://peekpanda.com), which stores dated daily snapshots of the public Apple free, paid and grossing charts. The tool calls `GET /v1/charts/apps/{storeId}/history` on the API, which is the `get_app` tool with action `chart_history` over MCP. Storefronts covered: us, gb, fr, de, br, be, jp, kr, cn, ru. Grossing is a chart position, not revenue. See the [chart history endpoint docs](https://peekpanda.com/docs/apple-chart-history) for parameters and errors.

You need a PeekPanda account and an API key.

## Use it

```bash
git clone https://github.com/fdarkaou/app-chart-rank-tracker && cd app-chart-rank-tracker
export PEEKPANDA_TOKEN=...   # API key from Account → API keys. Keep it out of source control.

node cli.js 1000000001 1000000002                          # Markdown table, US free chart
node cli.js 1000000001 1000000002 --chart grossing --country gb
node cli.js 1000000001 --category 6013 --limit 60 --format csv > ranks.csv
node cli.js 1000000001 1000000002 --alert 5                # only apps that moved 5+ places
```

Try it without an account on the bundled examples:

```bash
node cli.js --file examples/rival-a.json --file examples/rival-b.json --file examples/not-charted.json
```

Options: `--country`, `--category`, `--chart free|paid|grossing`, `--limit 1-100`, `--window <days>`, `--format md|csv|json`, `--alert <n>`, `--slack-webhook <url>`, `--file <path>`, `--tenancy`, `--api`. Run `node cli.js --help` for details.

Apps are fetched one after another to stay gentle on rate limits. On a 429 the error shows the `Retry-After` value when the API sends one.

## How to read the numbers

- A positive change (▲) means the app moved up the chart, so its rank number went down.
- An app with no stored position shows "not in chart", never rank 0.
- "Gap days" counts days between the first and latest observation that have no stored rank. A gap stays a gap; it is not filled in.
- Compare apps only on the same storefront, category and chart type. The table header says which one you are looking at.

## Daily Slack alert

`.github/workflows/daily-ranks.yml` is an example GitHub Actions job that writes the table to the run summary each weekday morning and posts movers to a Slack incoming webhook. Add `PEEKPANDA_TOKEN` and `SLACK_WEBHOOK_URL` as repository secrets, set the repository variable `ENABLE_RANK_TRACKER` to `true`, and put your own store ids in the file.

## From an AI assistant (MCP)

If PeekPanda is connected in Claude Code, Codex or Cursor (`https://mcp.peekpanda.com/mcp`, see the [MCP docs](https://peekpanda.com/docs/mcp)), ask it to call `get_app` with action `chart_history` for each rival, save each result as a JSON file, then run `node cli.js --file a.json --file b.json`. The request looks like:

```json
{ "name": "get_app", "arguments": { "request": { "action": "chart_history", "params": { "storeId": "1000000001" }, "query": { "country": "us", "chartType": "free", "limit": 30 } } } }
```

## Tests

```bash
npm test
```

MIT license.
