# Roadmap

This is a practice backlog in the shape of a Jira board. One repo, two ways to run it: people clone it (open source), or they invite the bot you host. The hosted bot is the same code plus your GGScore Premium key. There is no separate private codebase and no billing yet.

## How to read a ticket

A job board is a list of promises, not a diary. Each row is one deliverable a teammate could pick up without asking you what you meant.

| Field | Meaning |
|---|---|
| Key | Stable id. Epics are `LAUNCH`. Stories are `LAUNCH-1`. Never renumber after people start referring to them. |
| Type | **Epic** is a goal. **Story** is something a user or operator can see. **Task** is a chore inside a story. |
| Status | `To Do`, `In Progress`, `Done`. Only one story should be `In Progress` per person. |
| Priority | `Highest` blocks launch. `High` is this sprint. `Medium` is next. `Low` is later. |
| Points | Relative size, not hours. 1 is tiny, 2 is a short change, 3 is a normal story, 5 needs design, 8 should be split. |
| Acceptance criteria | Checkable facts. The story is done when every box is true, not when the code "seems fine." |

A sprint is usually two weeks. You commit to a handful of stories whose points you can finish. Everything else stays in the backlog.

## Board

### LAUNCH — Public bot that does not burn the shared API

Goal: one hosted process on GGScore Premium (100 requests/day) can serve every invited server. Self-hosters keep a Free key. Status: In Progress.

| Key | Type | Status | Priority | Points | Summary |
|---|---|---|---|---|---|
| LAUNCH-1 | Story | Done | Highest | 2 | Document invite vs self-host, and stop claiming `/setup` stores a single page |
| LAUNCH-2 | Story | Done | Highest | 3 | Stop one admin from spending the whole daily quota |
| LAUNCH-3 | Task | To Do | Highest | 1 | Subscribe to GGScore Premium and set the hosted env |
| LAUNCH-4 | Task | To Do | High | 2 | Verify the Discord app and enable the App Directory |
| LAUNCH-5 | Task | To Do | Medium | 1 | List the bot on Top.gg once it is online with a full cache |

### SCORE — Show the match clearly

Goal: a showcase and a live scorecard that a server can read at a glance. Status: In Progress.

| Key | Type | Status | Priority | Points | Summary |
|---|---|---|---|---|---|
| SCORE-1 | Story | In Progress | High | 3 | Demo wagers drip into a separate pool and never touch real credits |
| SCORE-2 | Story | In Progress | High | 3 | Scorecard is a header, one card per team, one card per map |

### STATS — Player lines on a finished match

Goal: show real per-player numbers after a match. Do not render placeholders. Status: To Do. Blocked until someone confirms the payload has player rows.

| Key | Type | Status | Priority | Points | Summary |
|---|---|---|---|---|---|
| STATS-1 | Task | To Do | Medium | 2 | Confirm whether GGScore game payloads include player arrays |
| STATS-2 | Story | To Do | Medium | 5 | Show rating, K-D, ADR, and maps played for each player |

### SAT — Small follow-ups after launch

Not required for the public invite. Status: To Do.

| Key | Type | Status | Priority | Points | Summary |
|---|---|---|---|---|---|
| SAT-1 | Story | To Do | Low | 3 | Personal wager history |
| SAT-2 | Story | To Do | Low | 2 | Channel note when a wager pays out |
| SAT-3 | Story | To Do | Low | 5 | Optional follow for a favorite team |

## Sprint 1

Take only the launch blocker. Leave stats and satisfaction in the backlog.

Committed: `LAUNCH-3`. `LAUNCH-1` and `LAUNCH-2` are done. `LAUNCH-4` starts after the hosted bot has been online on a real schedule for a day.

## Tickets

### LAUNCH-1 — Document invite vs self-host

**Status:** Done  
**Acceptance criteria:**

- README explains the invite bot (your Premium key) and self-host (their own key).
- README no longer says one `/setup` stores a single page.
- `.env.example` mentions Free (3/day) vs Premium (100/day), cooldown, and scheduled hours.

### LAUNCH-2 — Cap shared GGScore usage

**Status:** Done  
**Why:** `/sync` upcoming still spends every remaining call, the cooldown is forgotten on restart, and a stale `/setup` ignores the cooldown. One server can empty the pool every other server uses.

**Acceptance criteria:**

- `GGSCORE_MAX_UPCOMING_PAGES` limits a heavy sync. Hosted value is 10. Self-host default is 3.
- `GGSCORE_RESERVE_CALLS` blocks a heavy sync when remaining calls are at or below the reserve. Hosted value is 10. Self-host default is 1. `/sync` results and countries may use the reserve.
- `GGSCORE_MANUAL_HEAVY_SYNCS_PER_DAY` caps manual upcoming/full syncs. Hosted value is 2. Self-host default is 3. Scheduled syncs do not count.
- The manual count and the last heavy-sync time are stored in SQLite, so a restart does not reset them.
- The existing one-hour cooldown still applies on top of the daily cap.
- If scheduled hours are set and the cache already has matches, `/setup` does not call GGScore.
- If the cache is empty, `/setup` may do one capped upcoming fetch, and that fetch counts as a manual heavy sync.
- If scheduled hours are empty, a stale `/setup` may still refresh, under the same caps.
- `/quota` and `/help` say that upcoming/full syncs are capped and that results can still be refreshed.
- Hosted worst case stays near half of 100: two scheduled syncs of 10 pages plus one results call (22), two manual heavy syncs (20), and up to 10 reserved results calls.

**Hosted env this story must support:**

```env
GGSCORE_DAILY_LIMIT=100
GGSCORE_SYNC_ON_START=false
GGSCORE_MAX_UPCOMING_PAGES=10
GGSCORE_RESERVE_CALLS=10
GGSCORE_MANUAL_HEAVY_SYNCS_PER_DAY=2
GGSCORE_SYNC_COOLDOWN_MS=3600000
GGSCORE_SCHEDULED_SYNC_HOURS=6,18
```

### LAUNCH-3 — Turn on Premium for the hosted process

**Status:** To Do  
**Type:** Task (operator work, not a code change)

**Acceptance criteria:**

- GGScore Premium is active (100 requests/day).
- The hosted `.env` matches the block in `LAUNCH-2`.
- A second API key is not used to multiply the daily cap. Production uses one key.
- `GGSCORE_SYNC_ON_START` stays false.

### LAUNCH-4 — Discord App Directory

**Status:** To Do  
**Depends on:** `LAUNCH-3`, and a day of the bot online with a populated cache.

**Acceptance criteria:**

- The app owner completes Discord verification, including the Stripe identity check.
- The bot profile has a support server, a description, at least one tag, and an install link with the permissions the bot needs.
- Discovery is enabled in the Developer Portal.
- The public description says schedule, watch party, and virtual credits. It does not say gambling.

### LAUNCH-5 — Top.gg

**Status:** To Do  
**Depends on:** `LAUNCH-4` is not required, but the bot must be online during their review.

**Acceptance criteria:**

- The bot is submitted at https://top.gg/bot/new while it is online.
- The invite URL includes send messages, embed links, and create events.
- The description matches the App Directory wording.

### SCORE-1 — Demo market

**Status:** In Progress

**Acceptance criteria:**

- While a demo market is open, simulated wagers are added and labeled `(sim)`.
- Demo credits never change a real user balance.

### SCORE-2 — Scorecard layout

**Status:** In Progress

**Acceptance criteria:**

- A scorecard has a header, one card per team (blue and red sidebars), and one card per map.
- A finished map uses the winner’s color. A map still in progress stays amber.

### STATS-1 — Confirm player data exists

**Status:** To Do

**Acceptance criteria:**

- A real GGScore games payload is inspected for player rows.
- The ticket is updated with where rating, K-D, ADR, and maps played come from, or with the decision to use another source.
- No stats UI is built in this ticket.

### STATS-2 — Player cards

**Status:** To Do  
**Depends on:** `STATS-1` finding real fields.

**Acceptance criteria:**

- A finished match can show one line per player with rating, K-D, ADR, and maps played.
- Missing fields are omitted. They are not filled with zeros or guesses.

### SAT-1 — Wager history

**Status:** To Do

**Acceptance criteria:**

- A user can see their own past wagers in that server: match, pick, stake, and payout.

### SAT-2 — Payout note

**Status:** To Do

**Acceptance criteria:**

- When a wager settles, the channel gets a short note naming who was paid.
- Users who did not bet are not pinged.

### SAT-3 — Favorite team

**Status:** To Do

**Acceptance criteria:**

- A user can follow one team.
- The server only gets extra posts for that team’s matches, and the user can turn it off.

## Explicitly not in this backlog

- Charging servers, Stripe, or a premium Discord role.
- A private fork of the bot.
- A second hosted process, or buying Black for unlimited calls.
- Treating the five GGScore API keys as five times the daily quota.
