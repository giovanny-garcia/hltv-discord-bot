# CS2 Discord Bot

A Discord bot for Counter-Strike 2 watch parties and friendly wagers. It posts the day's tier-one matches, adds each one to the server Events list, and opens a pick-your-team wager before the match. Match data comes from the [GGScore](https://ggscore.net) API and is stored in SQLite. Built with **Node.js**, **TypeScript**, and **discord.js**.

API calls happen only when the schedule is refreshed. Slash commands, announcements, the calendar, and wagers read from that cache.

## Two ways to run it

| Path | Who pays for GGScore | What to use |
|------|----------------------|-------------|
| **Invite the hosted bot** | The host (this repo’s operator) | [GGScore Premium](https://ggscore.net/pricing) (100 req/day) on the host |
| **Self-host** | You (bring your own key) | Free (3/day) is enough to try; Premium if you want a deeper schedule |

Guild count does not multiply API spend: one process shares one SQLite cache. Announcements, Events, and wagers never call GGScore.

### Invite (hosted)

Works out of the box once the host has a Premium key and the env below. Invitees only run `/setup`.

Recommended host env:

```env
GGSCORE_DAILY_LIMIT=100
GGSCORE_SYNC_ON_START=false
GGSCORE_MAX_UPCOMING_PAGES=10
GGSCORE_RESERVE_CALLS=10
GGSCORE_MANUAL_HEAVY_SYNCS_PER_DAY=2
GGSCORE_SYNC_COOLDOWN_MS=3600000
GGSCORE_SCHEDULED_SYNC_HOURS=6,18
```

That keeps `SYNC_ON_START` off (so redeploys do not burn quota) and refreshes twice a day in UTC. Each refresh is capped at 10 upcoming pages plus one results call, and it leaves 10 calls that only results and countries can use. Admins get 2 manual schedule syncs per day, an hour apart, and that count survives a restart. One server cannot empty the shared day budget.

### Self-host (bring your own key)

Use a [Free or Premium key](https://ggscore.net/pricing). Set `GGSCORE_DAILY_LIMIT` to match your plan (Free = `3`, Premium = `100`). Leave `GGSCORE_SCHEDULED_SYNC_HOURS` empty on Free so automatic syncs do not spend the day’s three calls. Sync sparingly with `/setup` or `/sync`.

## For a server

Invite the bot, then one person with Manage Server runs **`/setup`** in the channel the group already uses. That is the whole start.

`/setup` does four things:

1. Uses that channel for the daily schedule and for wagers (pass `announcements` or `betting` only if you want them split)
2. Loads the schedule if the cache is empty. When this process has no automatic sync hours, it also refreshes a cache older than 12 hours, under the same caps
3. Includes tier-one events on its own: Majors, BLAST, ESL Pro League, IEM, and the Esports World Cup
4. Turns on watch parties and betting for those matches

After that, nobody else configures anything.

| Who | What they do |
|-----|----------------|
| Someone with Manage Server | `/setup` once |
| Everyone else | Mark **Interested** on the server event, then pick a team when the wager opens |
| Bragging rights | `/leaderboard` — everyone starts with 1000 credits |
| A tournament that is not tier-one | `/events track` |
| Too many extras tracked | `/events reset` |

Each match shows up under the server's **Events** list. Interested is the watch party. The bot needs the **Create Events** permission (Server Settings → Integrations → the bot).

Wagers open before the match, lock shortly after it starts, and pay out when the result lands in the cache. `/balance` shows your credits.

## Run the bot

- Node.js 18+
- A [Discord bot token](https://discord.com/developers/applications)
- A [GGScore API key](https://ggscore.net/pricing)

```bash
git clone https://github.com/giovanny-garcia/hltv-discord-bot.git
cd hltv-discord-bot
npm install
cp .env.example .env
```

On Windows PowerShell, copy the template with `Copy-Item .env.example .env`.

Edit `.env`, then:

```bash
npm run dev
```

Invite the bot with the `bot` and `applications.commands` scopes, plus permission to send messages, embed links, and create events. Set `DISCORD_GUILD_ID` so slash commands show up in your server immediately.

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DISCORD_TOKEN` | Yes | Bot token from the Discord Developer Portal |
| `DISCORD_CLIENT_ID` | Yes | Application ID |
| `DISCORD_GUILD_ID` | No | Register slash commands to one guild instantly (recommended for dev) |
| `GGSCORE_API_KEY` | Yes | API key from the GGScore cabinet |
| `GGSCORE_BASE_URL` | No | Defaults to `https://ggscore.net` |
| `GGSCORE_DAILY_LIMIT` | No | Defaults to `3` (Free). Set to `100` on Premium |
| `GGSCORE_SYNC_ON_START` | No | If `true`, refreshes on boot and spends API calls immediately (keep `false` on hosted) |
| `GGSCORE_SYNC_COOLDOWN_MS` | No | Min ms between heavy syncs (default: 1 hour, stored in SQLite). `0` disables |
| `GGSCORE_MAX_UPCOMING_PAGES` | No | Upcoming pages per heavy sync (default: `3`, hosted: `10`, max `20`) |
| `GGSCORE_RESERVE_CALLS` | No | Calls heavy syncs will not spend (default: `1`, hosted: `10`). `/sync` results and countries may use them |
| `GGSCORE_MANUAL_HEAVY_SYNCS_PER_DAY` | No | Manual upcoming/full syncs per UTC day (default: `3`, hosted: `2`). Scheduled syncs do not count |
| `GGSCORE_SCHEDULED_SYNC_HOURS` | No | UTC hours for automatic full sync, e.g. `6,18`. Empty = off (default) |
| `POLL_INTERVAL_MS` | No | How often the morning schedule is checked (default: 10 minutes) |

**Never commit `.env`.** It is gitignored. If a Discord token or GGScore API key is exposed, regenerate it and update the local file.

[GGScore plans](https://ggscore.net/pricing): Free 3 req/day · Premium 100/day · Black unlimited. Each **page** of upcoming matches is one request (~50 fixtures). A heavy sync fetches at most `GGSCORE_MAX_UPCOMING_PAGES` and will not spend the last `GGSCORE_RESERVE_CALLS`. `/quota` shows what is left, the page cap, and how many manual schedule syncs are left today.

| Action | API calls |
|--------|-----------|
| `/setup` when scheduled hours are set and the cache has matches | 0 |
| `/setup` when the cache is empty | one capped upcoming fetch (counts as a manual heavy sync) |
| `/setup` when scheduled hours are empty and the cache is stale | same caps as a manual heavy sync; results may still refresh |
| `/setup` when the cache is fresh | 0 |
| `/sync scope:upcoming` | up to `GGSCORE_MAX_UPCOMING_PAGES`, leaving the reserve. Manual heavy sync. Cooldown applies |
| `/sync scope:full` | those upcoming pages, then 1 results call above the reserve. Manual heavy sync. Cooldown applies |
| `/sync scope:results` or `countries` | 1 (may use the reserve; no heavy-sync cap) |
| Scheduled sync (`GGSCORE_SCHEDULED_SYNC_HOURS`) | one capped full sync per listed UTC hour. Does not count as manual |
| Schedule posts, Events calendar, wagers, `/matches`, `/leaderboard` | 0 |

## Slash commands

| Command | Description |
|---------|-------------|
| `/setup` | Start the server: channel, schedule, tier-one matches, watch parties, and wagers |
| `/help` | Short guide for schedules, watch parties, and wagers |
| `/ping` | Health check |
| `/events` | List the cache (`⭐` tier-one / `📌` added), `/events defaults` for the rules, track, hide, or reset |
| `/leaderboard` | Top credit balances |
| `/balance` | Your credits |
| `/next` | The next match on this server's watch list |
| `/timezone` | Show or set the server timezone (`America/Chicago` and the rest) |
| `/matches` | Upcoming matches from cache |
| `/results` | Recent results from cache |
| `/quota` | Daily API usage and cache age |
| `/sync` | Refresh from GGScore now (upcoming/full are capped; results can still refresh) |
| `/settings` | Announcement hour and on/off switch |
| `/unsubscribe` | Stop announcements for this server |
| `/scoreboard` | Repost or list match scorecards |
| `/betting` | Manually open, lock, or settle a market |
| `/demo` | Dev only — simulated match (needs `DEV_GUILD_ID`) |
| `/test` | Dev only — preview match/betting UI (needs `DEV_GUILD_ID`) |

`/subscribe` only sets an announcement channel. Prefer `/setup`.

Commands that need Manage Server: `/setup`, `/events` changes, `/sync`, `/settings`, `/unsubscribe`, `/betting`, and `/scoreboard`.

## Scripts

```bash
npm run dev      # development with hot reload
npm run build    # compile TypeScript to dist/
npm start        # run compiled bot
```

## Architecture

```
/setup, /sync, or scheduled hours  →  GGScore API  →  SQLite cache
                                                         │
               morning schedule, Events calendar, scoreboards, wagers
```

The poll loop and the match lifecycle never call GGScore. They read the cache. Tier-one matches are chosen by tournament name, because GGScore does not send a tier. `/events track` adds other tournaments. `/events untrack` hides one, including a tier-one event. `/events reset` drops extras and unmuted hides so the server is back on the default feed.

## Limitations

- GGScore's public API provides schedules and results, not live round-by-round data
- Free tier: 3 requests/day; Premium: 100/day (set `GGSCORE_DAILY_LIMIT` to match)
- A heavy sync fetches at most `GGSCORE_MAX_UPCOMING_PAGES` (~50 fixtures each) and will not spend the reserved calls
- Event listings are derived from cached matches, not a dedicated events endpoint

## License

[MIT](LICENSE)
