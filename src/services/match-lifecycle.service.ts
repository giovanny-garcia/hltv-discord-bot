import type { Client, GuildTextBasedChannel, TextChannel } from "discord.js";
import type { GuildSettings } from "../types/index.js";
import { lifecycleBoardFromSession } from "../types/lifecycle.js";
import {
  getAllGuildSettings,
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
import { filterTrackedMatches } from "../utils/event-cache.util.js";
import { findPlayedMatchSnapshot } from "../utils/ggscore-played.util.js";
import {
  formatTimestamp,
  normalizeGgscoreMatch,
  type NormalizedGgscoreMatch,
} from "../utils/ggscore-match.util.js";
import {
  buildMatchBoardComponents,
  buildMatchBoardEmbed,
  matchBoardHeader,
  type MatchBoardData,
} from "../utils/match-board.embed.js";

async function fetchTextChannel(
  client: Client,
  channelId: string,
): Promise<TextChannel | null> {
  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel?.isTextBased() || channel.isDMBased()) return null;
  return channel as TextChannel;
}

function persistBoard(sessionId: number, board: MatchBoardData): string {
  return JSON.stringify(board);
}

async function upsertScoreboard(
  client: Client,
  settings: GuildSettings,
  session: { id: number; boardChannelId?: string; boardMessageId?: string },
  board: MatchBoardData,
  header?: string,
): Promise<void> {
  const channelId = settings.channelId;
  const channel = await fetchTextChannel(client, channelId);
  if (!channel) return;

  const boardJson = persistBoard(session.id, board);
  const payload = {
    content: header,
    embeds: [buildMatchBoardEmbed(board)],
    components: buildMatchBoardComponents(board),
  };

  if (session.boardMessageId && session.boardChannelId) {
    const existingChannel = await fetchTextChannel(client, session.boardChannelId);
    const message = await existingChannel?.messages.fetch(session.boardMessageId).catch(() => null);
    if (message) {
      await message.edit(payload);
      updateLifecycleSession(session.id, {
        boardChannelId: session.boardChannelId,
        boardMessageId: session.boardMessageId,
        boardJson,
        hideSpoilers: board.hideSpoilers,
      });
      return;
    }
  }

  const message = await channel.send(payload);
  updateLifecycleSession(session.id, {
    boardChannelId: channel.id,
    boardMessageId: message.id,
    boardJson,
    hideSpoilers: board.hideSpoilers,
  });
}

async function sendChannelMessage(
  client: Client,
  channelId: string,
  content: string,
): Promise<void> {
  const channel = await fetchTextChannel(client, channelId);
  if (!channel) return;
  await channel.send({ content }).catch((error) => {
    console.error(`Lifecycle message failed for ${channelId}:`, error);
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
  try {
    const opened = await openMarketForMatch(settings.guildId, bettingChannel, match);
    marketId = opened.marketId;
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

  const when = formatTimestamp(match.scheduledAt);
  await sendChannelMessage(
    client,
    bettingChannelId,
    [
      `💰 **Betting is open** — ${match.team1Name} vs ${match.team2Name}`,
      match.eventName ? `🏆 ${match.eventName}` : null,
      `Match starts ${when}`,
      `Wagers lock **${settings.bettingLockMinutesAfterStart} min** after start.`,
    ]
      .filter(Boolean)
      .join("\n"),
  );

  await sendChannelMessage(
    client,
    settings.channelId,
    [
      `💰 **Betting window open** — ${match.team1Name} vs ${match.team2Name}`,
      match.eventName ? `🏆 ${match.eventName}` : null,
      `Starts ${when} · Head to <#${bettingChannelId}> to wager.`,
    ]
      .filter(Boolean)
      .join("\n"),
  );

  updateLifecycleSession(session.id, {
    status: "betting_open",
    marketId,
    bettingOpenSent: true,
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
    hideSpoilers: true,
  });
  await upsertScoreboard(
    client,
    settings,
    session,
    board,
    matchBoardHeader(board),
  );

  await sendChannelMessage(
    client,
    settings.channelId,
    [
      `🔴 **Match started** — ${match.team1Name} vs ${match.team2Name}`,
      match.eventName ? `🏆 ${match.eventName}` : null,
      `Scorecard updates spoiler-free — use **Show spoilers** when ready.`,
    ]
      .filter(Boolean)
      .join("\n"),
  );

  updateLifecycleSession(session.id, {
    status: "live",
    matchStartSent: true,
    hideSpoilers: true,
  });
}

async function handleBettingLock(
  client: Client,
  settings: GuildSettings,
  match: NormalizedGgscoreMatch,
): Promise<void> {
  const session = getLifecycleSession(settings.guildId, match.id);
  if (!session) return;

  await lockMarketForMatch(settings.guildId, match.id, client);

  const bettingChannelId = resolveBettingChannelId(settings.guildId);
  if (bettingChannelId) {
    await sendChannelMessage(
      client,
      bettingChannelId,
      `🔒 **Betting closed** — ${match.team1Name} vs ${match.team2Name}\nNo more wagers accepted.`,
    );
  }

  await sendChannelMessage(
    client,
    settings.channelId,
    `🔒 **Betting window closed** for ${match.team1Name} vs ${match.team2Name}.`,
  );

  updateLifecycleSession(session.id, {
    bettingLockSent: true,
  });
}

async function handleMapUpdate(
  client: Client,
  settings: GuildSettings,
  session: Awaited<ReturnType<typeof getLifecycleSession>> & object,
  mapsCompleted: number,
  team1Series: number,
  team2Series: number,
): Promise<void> {
  const board = lifecycleBoardFromSession(
    { ...session, team1Series, team2Series },
    "between_maps",
    {
      currentMap: mapsCompleted,
      hideSpoilers: true,
    },
  );

  await upsertScoreboard(
    client,
    settings,
    session,
    board,
    matchBoardHeader(board),
  );

  await sendChannelMessage(
    client,
    settings.channelId,
    [
      `⏸️ **Map ${mapsCompleted} complete** — ${session.team1Name} vs ${session.team2Name}`,
      `Series score hidden on the scorecard — no spoilers.`,
    ].join("\n"),
  );

  updateLifecycleSession(session.id, {
    mapsAnnounced: mapsCompleted,
    team1Series,
    team2Series,
    hideSpoilers: true,
  });
}

async function handleMatchFinish(
  client: Client,
  settings: GuildSettings,
  session: NonNullable<Awaited<ReturnType<typeof getLifecycleSession>>>,
  snapshot: ReturnType<typeof findPlayedMatchSnapshot> & object,
): Promise<void> {
  const board = lifecycleBoardFromSession(
    {
      ...session,
      team1Series: snapshot.team1Series,
      team2Series: snapshot.team2Series,
      winnerSide: snapshot.winnerSide,
      hideSpoilers: true,
    },
    "finished",
    { hideSpoilers: true },
  );

  await upsertScoreboard(
    client,
    settings,
    session,
    board,
    matchBoardHeader(board),
  );

  await sendChannelMessage(
    client,
    settings.channelId,
    [
      `✅ **Match complete** — ${session.team1Name} vs ${session.team2Name}`,
      session.eventName ? `🏆 ${session.eventName}` : null,
      `Final score hidden — tap **Show spoilers** on the scorecard when you're ready.`,
    ]
      .filter(Boolean)
      .join("\n"),
  );

  if (snapshot.winnerSide) {
    await settleMarketForMatch(
      settings.guildId,
      session.matchId,
      snapshot.winnerSide,
      client,
    );
  }

  updateLifecycleSession(session.id, {
    status: "finished",
    team1Series: snapshot.team1Series,
    team2Series: snapshot.team2Series,
    winnerSide: snapshot.winnerSide,
    matchFinishSent: true,
    hideSpoilers: true,
  });
}

async function processGuildLifecycle(client: Client, settings: GuildSettings): Promise<void> {
  const tracked = getTrackedEvents(settings.guildId);
  if (tracked.length === 0) return;

  const now = Date.now();
  const upcoming = filterTrackedMatches(
    getCachedUpcomingMatches()
      .map(normalizeGgscoreMatch)
      .filter((m) => m.scheduledAt),
    tracked,
  );

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
