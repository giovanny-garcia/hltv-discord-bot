import type { Client, EmbedBuilder, TextChannel } from "discord.js";
import type { GuildSettings } from "../types/index.js";
import {
  getAllGuildSettings,
  getMutedEvents,
  getTrackedEvents,
} from "../storage/db.js";
import {
  ensureLifecycleSession,
  getActiveLifecycleSessions,
  getLifecycleSession,
  updateLifecycleSession,
} from "../storage/lifecycle-storage.js";
import {
  getCachedPlayedMatches,
  getCachedUpcomingMatches,
} from "./ggscore-cache.service.js";
import {
  lockMarketForMatch,
  openMarketForMatch,
  resolveBettingChannelId,
  settleMarketForMatch,
} from "./betting.service.js";
import {
  buildBoardForSession,
  healMissingScoreboards,
  refreshScoreboardFromSession,
  upsertScoreboard,
} from "./scoreboard.service.js";
import { filterEligibleMatches } from "../utils/event-cache.util.js";
import { findPlayedMatchSnapshot } from "../utils/ggscore-played.util.js";
import {
  normalizeGgscoreMatch,
  type NormalizedGgscoreMatch,
} from "../utils/ggscore-match.util.js";
import { lifecycleBoardFromSession } from "../types/lifecycle.js";
import { matchBoardHeader } from "../utils/match-board.embed.js";
import { matchStartEmbed } from "../utils/ggscore-embeds.js";
import { syncCalendarForGuild } from "./calendar.service.js";

async function fetchTextChannel(
  client: Client,
  channelId: string,
): Promise<TextChannel | null> {
  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel?.isTextBased() || channel.isDMBased()) return null;
  return channel as TextChannel;
}

async function sendChannelEmbed(
  client: Client,
  channelId: string,
  embed: EmbedBuilder,
): Promise<void> {
  const channel = await fetchTextChannel(client, channelId);
  if (!channel) return;
  await channel.send({ embeds: [embed] }).catch((error) => {
    console.error(`Lifecycle embed failed for ${channelId}:`, error);
  });
}

async function handleBettingOpen(
  client: Client,
  settings: GuildSettings,
  match: NormalizedGgscoreMatch,
): Promise<void> {
  const session = ensureLifecycleSession(settings.guildId, match);
  const bettingChannelId = resolveBettingChannelId(settings.guildId);
  if (!bettingChannelId) return;

  const bettingChannel = await fetchTextChannel(client, bettingChannelId);
  if (!bettingChannel) return;

  let marketId = session.marketId;
  let marketOpened = false;
  try {
    const opened = await openMarketForMatch(settings.guildId, bettingChannel, match);
    marketId = opened.marketId;
    marketOpened = true;
  } catch (error) {
    console.error("Auto open market failed:", error);
  }

  const board = lifecycleBoardFromSession(session, "upcoming", {
    scheduledInMinutes: Math.max(
      0,
      Math.round((match.scheduledAt! * 1000 - Date.now()) / 60_000),
    ),
  });
  await upsertScoreboard(client, settings, session, board);

  updateLifecycleSession(session.id, {
    status: marketOpened ? "betting_open" : session.status,
    marketId: marketOpened ? marketId : session.marketId,
    bettingOpenSent: marketOpened,
  });
}

async function handleMatchStart(
  client: Client,
  settings: GuildSettings,
  match: NormalizedGgscoreMatch,
): Promise<void> {
  const session = getLifecycleSession(settings.guildId, match.id);
  if (!session) return;

  const board = lifecycleBoardFromSession(session, "live", {
    currentMap: 1,
    hideSpoilers: false,
    spoilersRevealed: true,
  });
  await upsertScoreboard(
    client,
    settings,
    session,
    board,
    matchBoardHeader(board),
  );

  await sendChannelEmbed(client, settings.channelId, matchStartEmbed(match));

  updateLifecycleSession(session.id, {
    status: "live",
    matchStartSent: true,
    hideSpoilers: false,
  });
}

async function handleBettingLock(
  client: Client,
  settings: GuildSettings,
  match: NormalizedGgscoreMatch,
): Promise<void> {
  const session = getLifecycleSession(settings.guildId, match.id);
  if (!session) return;

  const locked = await lockMarketForMatch(settings.guildId, match.id, client);
  if (!locked) return;

  updateLifecycleSession(session.id, {
    bettingLockSent: true,
  });
}

async function handleMapUpdate(
  client: Client,
  settings: GuildSettings,
  session: NonNullable<Awaited<ReturnType<typeof getLifecycleSession>>>,
  snapshot: NonNullable<ReturnType<typeof findPlayedMatchSnapshot>>,
  mapsCompleted: number,
  team1Series: number,
  team2Series: number,
): Promise<void> {
  updateLifecycleSession(session.id, {
    mapsAnnounced: mapsCompleted,
    team1Series,
    team2Series,
  });

  const updated = getLifecycleSession(settings.guildId, session.matchId);
  if (!updated) return;

  const board = lifecycleBoardFromSession(updated, "between_maps", {
    currentMap: mapsCompleted,
    currentMapName: snapshot.lastCompletedMapName,
    hideSpoilers: false,
    spoilersRevealed: true,
  });

  await upsertScoreboard(
    client,
    settings,
    updated,
    board,
    matchBoardHeader(board),
  );
}

async function handleMatchFinish(
  client: Client,
  settings: GuildSettings,
  session: NonNullable<Awaited<ReturnType<typeof getLifecycleSession>>>,
  snapshot: NonNullable<ReturnType<typeof findPlayedMatchSnapshot>>,
): Promise<void> {
  updateLifecycleSession(session.id, {
    status: "finished",
    team1Series: snapshot.team1Series,
    team2Series: snapshot.team2Series,
    winnerSide: snapshot.winnerSide,
    matchFinishSent: true,
  });

  const updated = getLifecycleSession(settings.guildId, session.matchId);
  if (!updated) return;

  const board = buildBoardForSession(updated);
  await upsertScoreboard(
    client,
    settings,
    updated,
    board,
    matchBoardHeader(board),
  );

  if (snapshot.winnerSide) {
    await settleMarketForMatch(
      settings.guildId,
      session.matchId,
      snapshot.winnerSide,
      client,
    );
  }
}

async function processGuildLifecycle(client: Client, settings: GuildSettings): Promise<void> {
  const tracked = getTrackedEvents(settings.guildId);
  const muted = getMutedEvents(settings.guildId);

  const now = Date.now();
  const upcoming = filterEligibleMatches(
    getCachedUpcomingMatches()
      .map(normalizeGgscoreMatch)
      .filter((m) => m.scheduledAt),
    settings.feedMode,
    tracked,
    muted,
  );

  try {
    await syncCalendarForGuild(client, settings, upcoming);
  } catch (error) {
    console.error(`Calendar sync failed for guild ${settings.guildId}:`, error);
  }

  for (const match of upcoming) {
    const session = ensureLifecycleSession(settings.guildId, match);
    const scheduledMs = match.scheduledAt! * 1000;
    const openAt = scheduledMs - settings.bettingOpenMinutes * 60_000;
    const lockAt = scheduledMs + settings.bettingLockMinutesAfterStart * 60_000;

    if (now >= openAt && !session.bettingOpenSent) {
      await handleBettingOpen(client, settings, match);
    }
    if (now >= scheduledMs && !session.matchStartSent) {
      await handleMatchStart(client, settings, match);
    }
    if (now >= lockAt && !session.bettingLockSent) {
      await handleBettingLock(client, settings, match);
    }
  }

  const played = getCachedPlayedMatches();
  const active = getActiveLifecycleSessions(settings.guildId);

  for (const session of active) {
    const snapshot = findPlayedMatchSnapshot(
      session.matchId,
      played,
      session.team1Name,
      session.team2Name,
    );

    if (!snapshot) continue;

    if (
      snapshot.mapsCompleted > session.mapsAnnounced &&
      !snapshot.finished
    ) {
      await handleMapUpdate(
        client,
        settings,
        session,
        snapshot,
        snapshot.mapsCompleted,
        snapshot.team1Series,
        snapshot.team2Series,
      );
      continue;
    }

    if (snapshot.finished && !session.matchFinishSent) {
      await handleMatchFinish(client, settings, session, snapshot);
    }
  }

  const refreshedActive = getActiveLifecycleSessions(settings.guildId);
  await healMissingScoreboards(client, settings, refreshedActive);

  for (const session of refreshedActive) {
    try {
      await refreshScoreboardFromSession(client, settings, session);
    } catch (error) {
      console.error(`Scoreboard refresh failed for match ${session.matchId}:`, error);
    }
  }
}

export async function runMatchLifecyclePass(client: Client): Promise<void> {
  const guilds = getAllGuildSettings();
  for (const settings of guilds) {
    if (!settings.announceMatches) continue;
    try {
      await processGuildLifecycle(client, settings);
    } catch (error) {
      console.error(`Lifecycle pass failed for guild ${settings.guildId}:`, error);
    }
  }
}

export class MatchLifecycleService {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running = false;

  constructor(
    private client: Client,
    private intervalMs: number,
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    console.log(`Match lifecycle service started (interval: ${this.intervalMs}ms)`);
    void this.scheduleNext(0);
  }

  stop(): void {
    this.running = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private scheduleNext(delayMs: number): void {
    if (!this.running) return;
    this.timer = setTimeout(() => void this.run(), delayMs);
  }

  private async run(): Promise<void> {
    if (!this.running) return;
    try {
      await runMatchLifecyclePass(this.client);
    } catch (error) {
      console.error("Match lifecycle pass failed:", error);
    }
    this.scheduleNext(this.intervalMs);
  }
}
