# CS2 Discord Event Tracker Bot

A Discord bot that announces upcoming CS2 tournaments and matches. Supports **HLTV scraping** and/or the **[GGScore](https://ggscore.net) public API** with smart caching for free-tier quotas.

Built with **Node.js**, **TypeScript**, **discord.js**, [`hltv`](https://www.npmjs.com/package/hltv), and **GGScore REST**.

## Features

- **Tournament announcements** (HLTV) — new events and starting-soon reminders
- **Match announcements** — new matches and starting-soon reminders
- **GGScore integration** — cache-first design for 3 req/day free tier
- **Configurable data provider** — `hltv`, `ggscore`, or `both`
- **SQLite persistence** — guild settings, dedup, API quota tracking, GGScore cache

## Prerequisites

- Node.js 18+
- Discord bot token
- GGScore API key (for `DATA_PROVIDER=ggscore` or `both`) from [ggscore.net](https://ggscore.net)

## Installation

```bash
cd hltv-discord-bot
npm install
cp .env.example .env
```

Edit `.env` with your Discord token and GGScore key.

## Environment variables

```env
DISCORD_TOKEN=
DISCORD_CLIENT_ID=
DISCORD_GUILD_ID=

# hltv | ggscore | both
DATA_PROVIDER=ggscore

GGSCORE_API_KEY=
GGSCORE_DAILY_LIMIT=3          # set to 100 after Premium upgrade
GGSCORE_SYNC_ON_START=false    # true burns all 3 free requests on boot

POLL_INTERVAL_MS=600000
```

**Never commit `.env`.** If your API key was shared in chat, regenerate it in the GGScore cabinet.

## GGScore free tier strategy (3 requests/day)

The bot **never calls GGScore during normal polling**. All features read from a local SQLite cache.

| Action | API calls | Purpose |
|--------|-----------|---------|
| `/ggscore-sync scope:full` | 3 | Populate everything for MVP testing |
| `/ggscore-sync scope:upcoming` | 1 | Refresh upcoming matches |
| `/ggscore-sync scope:results` | 1 | Refresh recent results |
| `/ggscore-sync scope:countries` | 1 | Refresh country list |
| `/ggscore-upcoming` | 0 | Read cache |
| `/ggscore-results` | 0 | Read cache |
| `/ggscore-events` | 0 | Unique events from cache |
| `/ggscore-quota` | 0 | Usage + cache age |
| Poll loop (ggscore mode) | 0 | Announce from cache only |

### Recommended MVP test flow

1. Start bot with `DATA_PROVIDER=ggscore`
2. Run **`/ggscore-sync scope:full`** once (uses all 3 daily requests)
3. Test every command — all read from cache with zero extra API calls
4. Use the poll loop to verify match announcements from cached upcoming data
5. When satisfied, upgrade to Premium and set `GGSCORE_DAILY_LIMIT=100`

## Slash commands

### Core
| Command | Description |
|---------|-------------|
| `/ping` | Bot health check |
| `/subscribe channel:#announcements` | Set announcement channel |
| `/unsubscribe` | Remove subscription |
| `/settings` | View/update filters |

### HLTV (when `DATA_PROVIDER` includes hltv)
| Command | Description |
|---------|-------------|
| `/events` | Upcoming HLTV tournaments |
| `/matches` | Upcoming HLTV matches |

### GGScore (when `DATA_PROVIDER` includes ggscore)
| Command | Description |
|---------|-------------|
| `/ggscore-sync` | Fetch fresh data (uses quota) |
| `/ggscore-quota` | Daily usage + cache status |
| `/ggscore-upcoming` | Cached upcoming matches |
| `/ggscore-results` | Cached recent results |
| `/ggscore-events` | Cached unique events |
| `/ggscore-countries` | Cached countries |

## Running

```bash
npm run dev    # development
npm run build && npm start
```

## Data provider modes

| Mode | Tournaments | Matches | Live API calls |
|------|-------------|---------|----------------|
| `hltv` | HLTV scrape | HLTV scrape | Every poll (~2 req) |
| `ggscore` | N/A (use `/ggscore-events`) | GGScore cache | Only `/ggscore-sync` |
| `both` | HLTV scrape | GGScore cache | HLTV poll + manual GGScore sync |

## Limitations

- **GGScore public API** does not include live round/kill/player data — only schedules, results, countries
- For live round-by-round data you need GGScore Pro (`api.esportsdata.cc`) or HLTV scorebot
- Free tier: 3 requests/day — use `/ggscore-sync` deliberately

## License

MIT
