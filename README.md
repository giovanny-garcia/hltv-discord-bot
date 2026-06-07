# CS2 Discord Bot

A Discord bot that announces upcoming Counter-Strike 2 matches using the [GGScore](https://ggscore.net) public API. Built with **Node.js**, **TypeScript**, **discord.js**, and **SQLite**.

The bot is designed around GGScore's free tier: API calls happen only when you run `/sync`. Everything else — slash commands, announcements, and the poll loop — reads from a local cache.

## Features

- **Match announcements** — new matches and starting-soon reminders in your chosen channel
- **Cache-first architecture** — respects the 3 requests/day free tier
- **SQLite persistence** — guild settings, deduplication, API quota tracking, and cached datasets
- **Slash commands** — browse upcoming matches, results, events, and countries without burning quota

## Prerequisites

- Node.js 18+
- A [Discord bot token](https://discord.com/developers/applications)
- A [GGScore API key](https://ggscore.net)

## Quick start

```bash
git clone <your-repo-url>
cd cs2-discord-bot
npm install
cp .env.example .env
```

Edit `.env` with your Discord credentials and GGScore API key, then:

```bash
npm run dev
```

Invite the bot with the `bot` and `applications.commands` scopes. In your server, run `/subscribe` to pick an announcement channel, then `/sync scope:full` once to populate the cache.

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DISCORD_TOKEN` | Yes | Bot token from the Discord Developer Portal |
| `DISCORD_CLIENT_ID` | Yes | Application ID |
| `DISCORD_GUILD_ID` | No | Register slash commands to one guild instantly (recommended for dev) |
| `GGSCORE_API_KEY` | Yes | API key from the GGScore cabinet |
| `GGSCORE_BASE_URL` | No | Defaults to `https://ggscore.net` |
| `GGSCORE_DAILY_LIMIT` | No | Defaults to `3` (set to `100` on Premium) |
| `GGSCORE_SYNC_ON_START` | No | If `true`, runs a full sync on boot (uses all 3 free requests) |
| `POLL_INTERVAL_MS` | No | Announcement poll interval (default: 10 minutes) |

**Never commit `.env`.** It is gitignored. If an API key is ever exposed, regenerate it in the GGScore cabinet.

## Free tier strategy

| Action | API calls |
|--------|-----------|
| `/sync scope:full` | 3 |
| `/sync scope:upcoming` | 1 |
| `/sync scope:results` | 1 |
| `/sync scope:countries` | 1 |
| `/matches`, `/results`, `/events`, `/countries`, `/quota` | 0 |
| Poll loop (announcements) | 0 |

Recommended first run:

1. Start the bot with `GGSCORE_SYNC_ON_START=false`
2. Run **`/sync scope:full`** once
3. Test `/matches`, `/events`, and `/results` — all read from cache
4. Use `/subscribe` and wait for the poll loop to announce upcoming matches

## Slash commands

| Command | Description |
|---------|-------------|
| `/ping` | Health check |
| `/subscribe` | Set the announcement channel |
| `/unsubscribe` | Remove subscription |
| `/settings` | View or update match announcement settings |
| `/sync` | Fetch fresh data from GGScore (uses quota) |
| `/quota` | Daily API usage and cache status |
| `/matches` | Upcoming matches from cache |
| `/results` | Recent results from cache |
| `/events` | Events derived from cached matches |
| `/countries` | Countries from cache |

Commands marked with Manage Server permission: `/subscribe`, `/unsubscribe`, `/settings`, `/sync`.

## Scripts

```bash
npm run dev      # development with hot reload
npm run build    # compile TypeScript to dist/
npm start        # run compiled bot
```

## Architecture

```
Discord  ←→  Bot (discord.js)
                │
                ├── SQLite cache (matches, events, quota)
                │
                └── GGScore API  ← only /sync calls go here
```

Polling never hits the API. It compares cached upcoming matches against per-guild "seen" records and posts embeds for new matches or matches starting within the configured reminder window.

## Limitations

- GGScore's public API provides schedules and results, not live round-by-round data
- Free tier: 3 requests/day — plan your `/sync` usage accordingly
- Event listings are derived from cached match data, not a dedicated events endpoint

## License

MIT
