import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type Client,
  type GuildTextBasedChannel,
} from "discord.js";
import { getCachedUpcomingMatches } from "./ggscore-cache.service.js";
import {
  adjustBalance,
  clearUserBet,
  createMarket,
  getMarket,
  getMarketBets,
  getMarketByGuildAndMatch,
  getMarketPool,
  getOpenMarket,
  getOrCreateBalance,
  getUserBet,
  lockMarket,
  markBetResult,
  recordBetLoss,
  recordBetWin,
  settleMarket,
  updateMarketMessage,
  upsertUserBet,
} from "../storage/betting-storage.js";
import { getDb, getGuildSettings } from "../storage/db.js";
import type { BetMarket, BetSide } from "../types/betting.js";
import { MIN_BET, STARTING_BALANCE } from "../types/betting.js";
import { openMarketEmbed } from "../utils/betting.embed.js";
import { normalizeGgscoreMatch } from "../utils/ggscore-match.util.js";

export { MIN_BET, STARTING_BALANCE };

export function buildWagerButtons(marketId: number, team1: string, team2: string) {
  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`bet:pick:${marketId}:1`)
      .setLabel(team1.slice(0, 20))
      .setStyle(ButtonStyle.Primary)
      .setEmoji("🔵"),
    new ButtonBuilder()
      .setCustomId(`bet:pick:${marketId}:2`)
      .setLabel(team2.slice(0, 20))
      .setStyle(ButtonStyle.Danger)
      .setEmoji("🔴"),
  );

  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`bet:quick:${marketId}:1:100`)
      .setLabel("100 on T1")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`bet:quick:${marketId}:1:250`)
      .setLabel("250 on T1")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`bet:quick:${marketId}:2:100`)
      .setLabel("100 on T2")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`bet:quick:${marketId}:2:250`)
      .setLabel("250 on T2")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`bet:cancel:${marketId}`)
      .setLabel("Clear")
      .setStyle(ButtonStyle.Secondary),
  );

  return [row1, row2];
}

export async function openMarketForGuild(
  guildId: string,
  channel: GuildTextBasedChannel,
  matchIndex = 0,
): Promise<{ marketId: number; messageUrl: string }> {
  const upcoming = getCachedUpcomingMatches().map(normalizeGgscoreMatch);
  const match = upcoming[matchIndex];
  if (!match) {
    throw new Error(`Invalid match index. Cache has ${upcoming.length} upcoming matches (0-${upcoming.length - 1}).`);
  }
  return openMarketForMatch(guildId, channel, match);
}

export async function openMarketForMatch(
  guildId: string,
  channel: GuildTextBasedChannel,
  match: ReturnType<typeof normalizeGgscoreMatch>,
): Promise<{ marketId: number; messageUrl: string }> {
  const existing = getOpenMarket(guildId);
  if (existing) {
    if (existing.matchId === match.id) {
      return { marketId: existing.id, messageUrl: `https://discord.com/channels/${guildId}/${existing.channelId}/${existing.messageId}` };
    }
    throw new Error(
      `Market #${existing.id} is already open (${existing.team1Name} vs ${existing.team2Name}). Lock or settle it first.`,
    );
  }

  if (!match.team1Name || match.team1Name === "TBD" || !match.team2Name || match.team2Name === "TBD") {
    throw new Error(
      `Match is missing team names in cache. Try \`/sync scope:full\` again or pick another match.`,
    );
  }

  const market = createMarket({
    guildId,
    matchId: match.id,
    team1Name: match.team1Name,
    team2Name: match.team2Name,
    eventName: match.eventName,
    format: match.kind,
    channelId: channel.id,
    messageId: "pending",
    status: "open",
  });

  const pool = getMarketPool(market.id);
  const message = await channel.send({
    content: "💰 **Wagers are open** — tap a team or quick amount.",
    embeds: [openMarketEmbed(market, pool)],
    components: buildWagerButtons(market.id, market.team1Name, market.team2Name),
  });

  updateMarketMessage(market.id, message.id);
  return { marketId: market.id, messageUrl: message.url };
}

export async function refreshMarketMessageWithClient(
  marketId: number,
  client: Client,
): Promise<void> {
  const market = getMarket(marketId);
  if (!market) return;

  const channel = await client.channels.fetch(market.channelId).catch(() => null);
  if (!channel?.isTextBased() || channel.isDMBased()) return;

  const message = await (channel as GuildTextBasedChannel).messages.fetch(market.messageId).catch(() => null);
  if (!message) return;

  const pool = getMarketPool(marketId);
  const components =
    market.status === "open"
      ? buildWagerButtons(market.id, market.team1Name, market.team2Name)
      : [];

  await message.edit({
    embeds: [openMarketEmbed(market, pool)],
    components,
  });
}

export function placeWager(
  marketId: number,
  guildId: string,
  userId: string,
  side: BetSide,
  amount: number,
): { balance: number; teamName: string } {
  const market = getMarket(marketId);
  if (!market) throw new Error("Market not found.");
  if (market.status !== "open") throw new Error("Betting is locked for this match.");
  if (market.guildId !== guildId) throw new Error("Wrong server for this market.");

  if (!Number.isInteger(amount) || amount < MIN_BET) {
    throw new Error(`Minimum wager is **${MIN_BET}** credits.`);
  }

  const balance = getOrCreateBalance(guildId, userId);
  const existing = getUserBet(marketId, userId);
  const maxAffordable = balance.balance + (existing?.amount ?? 0);

  if (amount > maxAffordable) {
    throw new Error(`Not enough credits (max **${maxAffordable}**).`);
  }

  if (existing) adjustBalance(guildId, userId, existing.amount);
  adjustBalance(guildId, userId, -amount);
  upsertUserBet(marketId, guildId, userId, side, amount);

  const teamName = side === 1 ? market.team1Name : market.team2Name;
  return { balance: getOrCreateBalance(guildId, userId).balance, teamName };
}

export function cancelWager(marketId: number, guildId: string, userId: string): number {
  const market = getMarket(marketId);
  if (!market) throw new Error("Market not found.");
  if (market.status !== "open") throw new Error("Betting is locked.");

  const existing = getUserBet(marketId, userId);
  if (!existing) throw new Error("No active wager to clear.");

  adjustBalance(guildId, userId, existing.amount);
  clearUserBet(marketId, userId);
  markBetResult(marketId, userId, "refunded", 0);

  return getOrCreateBalance(guildId, userId).balance;
}

export async function lockMarketForGuild(guildId: string, client: Client): Promise<BetMarket> {
  const market = getOpenMarket(guildId);
  if (!market) throw new Error("No open market to lock.");

  const locked = lockMarket(market.id);
  if (!locked) throw new Error("Failed to lock market.");

  await refreshMarketMessageWithClient(locked.id, client);
  return locked;
}

export async function lockMarketForMatch(
  guildId: string,
  matchId: string,
  client: Client,
): Promise<BetMarket | null> {
  const market = getOpenMarket(guildId);
  if (!market || market.matchId !== matchId) return null;
  return lockMarketForGuild(guildId, client);
}

export async function settleMarketForMatch(
  guildId: string,
  matchId: string,
  winnerSide: BetSide,
  client: Client,
): Promise<{ marketId: number; winnersPaid: number; totalPaid: number } | null> {
  const market = getOpenMarket(guildId) ?? getMarketByGuildAndMatch(guildId, matchId);
  if (!market || market.matchId !== matchId) return null;
  if (market.status === "settled") return null;

  if (market.status === "open") {
    lockMarket(market.id);
  }

  const activeMarket = getMarket(market.id)!;
  const bets = getMarketBets(activeMarket.id);
  const pool = getMarketPool(activeMarket.id);
  const winningPool = winnerSide === 1 ? pool.team1Pool : pool.team2Pool;

  let winnersPaid = 0;
  let totalPaid = 0;

  for (const bet of bets) {
    if (bet.side === winnerSide) {
      const payout =
        winningPool > 0 ? Math.floor((bet.amount / winningPool) * pool.totalPool) : bet.amount;
      recordBetWin(guildId, bet.userId, payout);
      markBetResult(activeMarket.id, bet.userId, "won", payout);
      winnersPaid++;
      totalPaid += payout;
    } else {
      recordBetLoss(guildId, bet.userId, bet.amount);
      markBetResult(activeMarket.id, bet.userId, "lost", 0);
    }
  }

  settleMarket(activeMarket.id, winnerSide);
  await refreshMarketMessageWithClient(activeMarket.id, client);

  return { marketId: activeMarket.id, winnersPaid, totalPaid };
}

function getLatestLockedMarket(guildId: string): BetMarket | null {
  const row = getDb()
    .prepare(
      "SELECT * FROM bet_markets WHERE guild_id = ? AND status = 'locked' ORDER BY id DESC LIMIT 1",
    )
    .get(guildId) as Record<string, unknown> | undefined;
  if (!row) return null;
  return getMarket(Number(row.id));
}

export async function settleMarketForGuild(
  guildId: string,
  winnerSide: BetSide,
  client: Client,
): Promise<{ marketId: number; winnersPaid: number; totalPaid: number }> {
  const market = getOpenMarket(guildId) ?? getLatestLockedMarket(guildId);
  if (!market) throw new Error("No market to settle.");
  if (market.status === "settled") throw new Error("Already settled.");
  if (market.status === "open") {
    lockMarket(market.id);
  }

  const activeMarket = getMarket(market.id)!;
  const bets = getMarketBets(activeMarket.id);
  const pool = getMarketPool(activeMarket.id);
  const winningPool = winnerSide === 1 ? pool.team1Pool : pool.team2Pool;

  let winnersPaid = 0;
  let totalPaid = 0;

  for (const bet of bets) {
    if (bet.side === winnerSide) {
      const payout =
        winningPool > 0 ? Math.floor((bet.amount / winningPool) * pool.totalPool) : bet.amount;
      recordBetWin(guildId, bet.userId, payout);
      markBetResult(activeMarket.id, bet.userId, "won", payout);
      winnersPaid++;
      totalPaid += payout;
    } else {
      recordBetLoss(guildId, bet.userId, bet.amount);
      markBetResult(activeMarket.id, bet.userId, "lost", 0);
    }
  }

  settleMarket(activeMarket.id, winnerSide);
  await refreshMarketMessageWithClient(activeMarket.id, client);

  return { marketId: activeMarket.id, winnersPaid, totalPaid };
}

export function resolveBettingChannelId(guildId: string): string | null {
  const settings = getGuildSettings(guildId);
  return settings?.bettingChannelId ?? settings?.channelId ?? null;
}
