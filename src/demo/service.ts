import type { Client, TextChannel } from "discord.js";
import type { BetSide } from "../types/betting.js";
import { getGuildSettings } from "../storage/db.js";
import { resolveBettingChannelId } from "../services/betting.service.js";
import { registerMatchBoard } from "../test/board-registry.js";
import {
  buildMatchBoardComponents,
  buildMatchBoardEmbeds,
  matchBoardHeader,
  type MatchBoardData,
  type MatchBoardMap,
} from "../utils/match-board.embed.js";
import {
  adjustDemoBalance,
  clearDemoBet,
  clearDemoSession,
  getDemoBalance,
  getDemoBets,
  getDemoPool,
  getDemoSession,
  getDemoSessionForUpdate,
  getOrCreateDemoBalance,
  resetDemoEconomy,
  setDemoSession,
} from "./store.js";
import {
  DEMO_MAP_WIN_SCORE,
  DEMO_ROUNDS_PER_TICK,
  DEMO_SERIES_WIN,
  DEFAULT_DEMO_TICK_MS,
  demoBettingOpenTicks,
  demoMatchId,
  type DemoSession,
} from "./types.js";
import { buildDemoWagerButtons, demoBettingEmbed } from "./betting.embed.js";
import { clearBettingRoom, dripSimulatedDemoWagers, refreshDemoBettingMessage, markDemoBettingSettled } from "./betting.js";

const demoTimers = new Map<string, ReturnType<typeof setInterval>>();
const DEMO_MAP_POOL = ["Mirage", "Inferno", "Nuke", "Ancient", "Anubis", "Vertigo", "Dust2"];

function pickDemoMapName(mapIndex: number): string {
  return DEMO_MAP_POOL[(mapIndex - 1) % DEMO_MAP_POOL.length] ?? "Mirage";
}

function rollDemoSides(): { team1Side: "T" | "CT"; team2Side: "T" | "CT" } {
  const team1Side = Math.random() < 0.5 ? "CT" : "T";
  return { team1Side, team2Side: team1Side === "CT" ? "T" : "CT" };
}

function demoBoardMaps(session: DemoSession): MatchBoardMap[] {
  const maps: MatchBoardMap[] = session.completedMaps.map((map) => ({
    name: map.name,
    team1Rounds: map.team1Rounds,
    team2Rounds: map.team2Rounds,
    winnerSide: map.winnerSide,
  }));

  if (session.phase === "live") {
    maps.push({
      name: session.currentMapName ?? `Map ${session.currentMap}`,
      team1Rounds: session.team1MapScore,
      team2Rounds: session.team2MapScore,
      live: true,
    });
  }

  return maps;
}

function buildDemoBoard(session: DemoSession): MatchBoardData {
  const phase =
    session.phase === "betting_open"
      ? "upcoming"
      : session.phase === "between_maps"
        ? "between_maps"
        : session.phase === "finished"
          ? "finished"
          : "live";

  const hideSpoilers =
    session.phase === "betting_open" ? session.hideSpoilers : false;

  return {
    matchId: session.matchId,
    team1: {
      name: session.team1Name,
      color: 0x3498db,
      seriesScore: session.team1Series,
      mapScore: session.phase === "live" ? session.team1MapScore : undefined,
      playingSide: session.phase === "live" ? session.team1Side : undefined,
    },
    team2: {
      name: session.team2Name,
      color: 0xe74c3c,
      seriesScore: session.team2Series,
      mapScore: session.phase === "live" ? session.team2MapScore : undefined,
      playingSide: session.phase === "live" ? session.team2Side : undefined,
    },
    eventName: "Demo Invitational",
    format: "BO3",
    phase,
    live: session.phase === "live" || session.phase === "between_maps",
    currentMap: session.currentMap,
    currentMapName: session.currentMapName,
    maps: demoBoardMaps(session),
    hideSpoilers,
    spoilersRevealed: session.spoilersRevealed,
    placeholder: true,
    scheduledInMinutes: session.phase === "betting_open" ? 1 : undefined,
    winnerSide: session.winnerSide,
  };
}

async function fetchTextChannel(client: Client, channelId: string): Promise<TextChannel | null> {
  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel?.isTextBased() || channel.isDMBased()) return null;
  return channel as TextChannel;
}

async function publishDemo(client: Client, session: DemoSession): Promise<void> {
  const settings = getGuildSettings(session.guildId);
  const board = buildDemoBoard(session);
  registerMatchBoard(board);
  const boardEmbeds = buildMatchBoardEmbeds(board);

  if (settings?.channelId && settings.channelId !== session.bettingChannelId) {
    await updateDemoScoreboard(client, session);
  }

  await refreshDemoBettingMessage(client, session.guildId, boardEmbeds);
}

async function updateDemoScoreboard(client: Client, session: DemoSession): Promise<void> {
  const settings = getGuildSettings(session.guildId);
  if (!settings?.channelId) return;

  const channel = await fetchTextChannel(client, settings.channelId);
  if (!channel) return;

  const board = buildDemoBoard(session);
  registerMatchBoard(board);

  const payload = {
    content: matchBoardHeader(board),
    embeds: buildMatchBoardEmbeds(board),
    components: buildMatchBoardComponents(board),
  };

  if (session.boardMessageId) {
    const existing = await channel.messages.fetch(session.boardMessageId).catch(() => null);
    if (existing) {
      await existing.edit(payload);
      return;
    }
  }

  const message = await channel.send(payload);
  session.boardChannelId = channel.id;
  session.boardMessageId = message.id;
  setDemoSession(session);
}

function stopDemoTimer(guildId: string): void {
  const timer = demoTimers.get(guildId);
  if (timer) {
    clearInterval(timer);
    demoTimers.delete(guildId);
  }
}

function settleDemoPool(guildId: string, winnerSide: BetSide): {
  winnersPaid: number;
  totalPaid: number;
} {
  const session = getDemoSessionForUpdate(guildId);
  if (!session) return { winnersPaid: 0, totalPaid: 0 };

  const pool = getDemoPool(guildId);
  const winningPool = winnerSide === 1 ? pool.team1Pool : pool.team2Pool;
  let winnersPaid = 0;
  let totalPaid = 0;

  const slip: NonNullable<DemoSession["settledSlip"]> = [];
  for (const bet of getDemoBets(guildId)) {
    const payout =
      bet.side === winnerSide
        ? winningPool > 0
          ? Math.floor((bet.amount / winningPool) * pool.totalPool)
          : bet.amount
        : 0;
    if (bet.side === winnerSide) {
      adjustDemoBalance(guildId, bet.userId, payout);
      winnersPaid++;
      totalPaid += payout;
    }
    slip.push({
      userId: bet.userId,
      side: bet.side,
      amount: bet.amount,
      payout,
      displayName: bet.displayName,
      simulated: bet.simulated,
    });
    clearDemoBet(guildId, bet.userId);
  }
  session.settledSlip = slip;

  session.bettingStatus = "settled";
  session.winnerSide = winnerSide;
  markDemoBettingSettled(guildId, winnerSide);
  return { winnersPaid, totalPaid };
}

function pickMapWinner(session: DemoSession): BetSide {
  if (session.team1MapScore === session.team2MapScore) {
    return Math.random() < 0.5 ? 1 : 2;
  }
  return session.team1MapScore > session.team2MapScore ? 1 : 2;
}

async function finishDemoMatch(
  client: Client,
  guildId: string,
  winnerSide: BetSide,
  options?: { seriesScore?: [number, number] },
): Promise<{ winnersPaid: number; totalPaid: number; winnerName: string }> {
  const session = getDemoSessionForUpdate(guildId);
  if (!session) {
    throw new Error("No demo is running.");
  }

  const [team1Series, team2Series] =
    options?.seriesScore ??
    (winnerSide === 1 ? ([DEMO_SERIES_WIN, Math.min(session.team2Series, DEMO_SERIES_WIN - 1)] as [number, number]) : ([Math.min(session.team1Series, DEMO_SERIES_WIN - 1), DEMO_SERIES_WIN] as [number, number]));

  session.phase = "finished";
  session.bettingStatus = session.bettingStatus === "open" ? "locked" : session.bettingStatus;
  session.team1Series = team1Series;
  session.team2Series = team2Series;
  session.team1MapScore = 0;
  session.team2MapScore = 0;
  session.hideSpoilers = true;
  session.spoilersRevealed = true;
  session.winnerSide = winnerSide;
  setDemoSession(session);

  stopDemoTimer(guildId);

  const { winnersPaid, totalPaid } = settleDemoPool(guildId, winnerSide);
  const stored = getDemoSessionForUpdate(guildId) ?? session;
  await publishDemo(client, stored);

  const winnerName = winnerSide === 1 ? session.team1Name : session.team2Name;
  return { winnersPaid, totalPaid, winnerName };
}

/**
 * Jump straight to a finished BO3 and settle demo wagers.
 * Useful when you do not want to wait for every tick.
 */
export async function concludeDemo(
  client: Client,
  guildId: string,
  winner?: BetSide,
): Promise<{ winnersPaid: number; totalPaid: number; winnerName: string; series: string }> {
  const session = getDemoSession(guildId);
  if (!session) {
    throw new Error("No demo is running. Start one with `/demo start` first.");
  }
  if (session.phase === "finished" || session.phase === "stopped") {
    throw new Error("This demo already ended. Start a new one with `/demo start`.");
  }

  const winnerSide =
    winner ??
    (session.team1Series !== session.team2Series
      ? session.team1Series > session.team2Series
        ? 1
        : 2
      : Math.random() < 0.5
        ? 1
        : 2);

  const result = await finishDemoMatch(client, guildId, winnerSide);
  const updated = getDemoSession(guildId);
  return {
    ...result,
    series: updated ? `${updated.team1Series}–${updated.team2Series}` : "2–0",
  };
}

async function runDemoTick(client: Client, guildId: string): Promise<void> {
  const session = getDemoSessionForUpdate(guildId);
  if (!session || session.phase === "stopped" || session.phase === "finished") {
    stopDemoTimer(guildId);
    return;
  }

  session.phaseTick++;

  if (session.phase === "betting_open") {
    dripSimulatedDemoWagers(guildId);
    if (session.phaseTick >= session.bettingOpenTicks) {
      session.phase = "live";
      session.phaseTick = 0;
      session.bettingStatus = "locked";
      session.hideSpoilers = false;
      session.spoilersRevealed = true;
      session.currentMapName = pickDemoMapName(session.currentMap);
      const sides = rollDemoSides();
      session.team1Side = sides.team1Side;
      session.team2Side = sides.team2Side;
    }
    await publishDemo(client, session);
    return;
  }

  if (session.phase === "between_maps") {
    if (session.phaseTick >= 1) {
      session.phase = "live";
      session.phaseTick = 0;
      session.team1MapScore = 0;
      session.team2MapScore = 0;
      session.currentMapName = pickDemoMapName(session.currentMap);
      const sides = rollDemoSides();
      session.team1Side = sides.team1Side;
      session.team2Side = sides.team2Side;
      await publishDemo(client, session);
    }
    return;
  }

  if (session.phase === "live") {
    for (let round = 0; round < DEMO_ROUNDS_PER_TICK; round++) {
      if (session.team1MapScore >= DEMO_MAP_WIN_SCORE || session.team2MapScore >= DEMO_MAP_WIN_SCORE) break;
      const scorer = Math.random() < 0.5 ? 1 : 2;
      if (scorer === 1) session.team1MapScore++;
      else session.team2MapScore++;
    }

    if (session.team1MapScore >= DEMO_MAP_WIN_SCORE || session.team2MapScore >= DEMO_MAP_WIN_SCORE) {
      const mapWinner = pickMapWinner(session);
      session.completedMaps.push({
        name: session.currentMapName ?? `Map ${session.currentMap}`,
        team1Rounds: session.team1MapScore,
        team2Rounds: session.team2MapScore,
        winnerSide: mapWinner,
      });
      if (mapWinner === 1) session.team1Series++;
      else session.team2Series++;

      if (session.team1Series >= DEMO_SERIES_WIN || session.team2Series >= DEMO_SERIES_WIN) {
        const winnerSide = session.team1Series > session.team2Series ? 1 : 2;
        await finishDemoMatch(client, guildId, winnerSide, {
          seriesScore: [session.team1Series, session.team2Series],
        });
        return;
      }

      session.phase = "between_maps";
      session.phaseTick = 0;
      session.currentMap++;
      await publishDemo(client, session);
      return;
    }

    await publishDemo(client, session);
  }
}

export interface StartDemoOptions {
  team1Name?: string;
  team2Name?: string;
  tickIntervalMs?: number;
}

export async function startDemo(
  client: Client,
  guildId: string,
  options: StartDemoOptions = {},
): Promise<{ matchId: string }> {
  stopDemo(guildId, false);

  const settings = getGuildSettings(guildId);
  if (!settings?.channelId) {
    throw new Error("Run `/setup` or `/subscribe` first to configure an announcement channel.");
  }

  const bettingChannelId = resolveBettingChannelId(guildId);
  if (!bettingChannelId) {
    throw new Error("Configure a betting channel via `/setup` before running a demo.");
  }

  const bettingChannel = await fetchTextChannel(client, bettingChannelId);
  if (!bettingChannel) {
    throw new Error("Could not access the betting channel — check bot permissions.");
  }

  resetDemoEconomy(guildId);

  const session: DemoSession = {
    guildId,
    matchId: demoMatchId(guildId),
    team1Name: options.team1Name ?? "Vitality",
    team2Name: options.team2Name ?? "NAVI",
    tickIntervalMs: options.tickIntervalMs ?? DEFAULT_DEMO_TICK_MS,
    phase: "betting_open",
    phaseTick: 0,
    currentMap: 1,
    team1MapScore: 0,
    team2MapScore: 0,
    team1Series: 0,
    team2Series: 0,
    completedMaps: [],
    simTarget: 6 + Math.floor(Math.random() * 5),
    bettingOpenTicks: demoBettingOpenTicks(options.tickIntervalMs ?? DEFAULT_DEMO_TICK_MS),
    hideSpoilers: false,
    spoilersRevealed: false,
    bettingChannelId,
    bettingStatus: "open",
  };

  setDemoSession(session);

  await clearBettingRoom(bettingChannel);

  const board = buildDemoBoard(session);
  registerMatchBoard(board);
  const bettingMessage = await bettingChannel.send({
    embeds: [
      ...buildMatchBoardEmbeds(board).slice(0, 9),
      demoBettingEmbed({
        team1Name: session.team1Name,
        team2Name: session.team2Name,
        status: "open",
        pool: getDemoPool(guildId),
        timing: `OPEN — locks in ${Math.round((session.bettingOpenTicks * session.tickIntervalMs) / 1000)}s, when this match goes live.`,
      }),
    ],
    components: buildDemoWagerButtons(session.team1Name, session.team2Name),
  });
  session.bettingChannelId = bettingChannel.id;
  session.bettingMessageId = bettingMessage.id;

  if (settings.channelId !== bettingChannel.id) {
    const announcementChannel = await fetchTextChannel(client, settings.channelId);
    if (announcementChannel) {
      const scoreMessage = await announcementChannel.send({
        embeds: buildMatchBoardEmbeds(board),
      });
      session.boardChannelId = announcementChannel.id;
      session.boardMessageId = scoreMessage.id;
    }
  }

  setDemoSession(session);

  const timer = setInterval(() => {
    void runDemoTick(client, guildId).catch((error) => {
      console.error(`Demo tick failed for guild ${guildId}:`, error);
    });
  }, session.tickIntervalMs);
  demoTimers.set(guildId, timer);

  return { matchId: session.matchId };
}

export function stopDemo(guildId: string, markStopped = true): void {
  stopDemoTimer(guildId);
  if (markStopped) {
    const session = getDemoSession(guildId);
    if (session) {
      session.phase = "stopped";
      setDemoSession(session);
    }
  }
}

export function clearDemo(guildId: string): void {
  stopDemo(guildId, false);
  clearDemoSession(guildId);
  resetDemoEconomy(guildId);
}

export { getDemoSession, getDemoBalance, getOrCreateDemoBalance, getDemoPool };

export function formatDemoStatus(guildId: string): string {
  const session = getDemoSession(guildId);
  if (!session) return "No demo running. Use `/demo start` to begin.";

  const pool = getDemoPool(guildId);
  const lines = [
    `**Phase:** ${session.phase.replace("_", " ")}`,
    `**Teams:** ${session.team1Name} vs ${session.team2Name}`,
    `**Series:** ${session.team1Series} – ${session.team2Series}`,
    `**Map ${session.currentMap}:** ${session.team1MapScore} – ${session.team2MapScore}`,
    `**Demo betting:** ${session.bettingStatus}`,
    `**Demo pool:** ${pool.totalPool} credits (${pool.betCount} wagers)`,
    `**Tick interval:** ${session.tickIntervalMs / 1000}s`,
  ];

  if (session.winnerSide) {
    const winner = session.winnerSide === 1 ? session.team1Name : session.team2Name;
    lines.push(`**Winner:** ${winner}`);
  }

  return lines.join("\n");
}
