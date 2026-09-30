import type { Client, EmbedBuilder, TextChannel } from "discord.js";
import type { BetSide } from "../types/betting.js";
import {
  adjustDemoBalance,
  clearDemoBet,
  getDemoBet,
  getDemoBets,
  getDemoPool,
  getDemoSession,
  getDemoSessionForUpdate,
  getOrCreateDemoBalance,
  setDemoSession,
  upsertDemoBet,
  validateDemoWagerAmount,
} from "./store.js";
import { demoBettingEmbed, buildDemoWagerButtons, type SlipBettor } from "./betting.embed.js";
import { DEMO_BETTING_OPEN_MS } from "./types.js";

const SIM_CAST = [
  { id: "sim:alex", name: "Alex" },
  { id: "sim:sam", name: "Sam" },
  { id: "sim:jordan", name: "Jordan" },
  { id: "sim:riley", name: "Riley" },
  { id: "sim:casey", name: "Casey" },
  { id: "sim:morgan", name: "Morgan" },
  { id: "sim:quinn", name: "Quinn" },
  { id: "sim:avery", name: "Avery" },
  { id: "sim:drew", name: "Drew" },
  { id: "sim:skyler", name: "Skyler" },
] as const;

const SIM_AMOUNTS = [50, 100, 100, 150, 200, 250, 400];

/** Place a slice of the planned synthetic wagers. Call once per open tick. */
export function dripSimulatedDemoWagers(guildId: string): void {
  const session = getDemoSessionForUpdate(guildId);
  if (!session || session.bettingStatus !== "open") return;

  const placed = getDemoBets(guildId).filter((bet) => bet.simulated);
  const remaining = session.simTarget - placed.length;
  if (remaining <= 0) return;

  const openTicks = session.bettingOpenTicks ?? Math.max(2, Math.round(DEMO_BETTING_OPEN_MS / session.tickIntervalMs));
  const ticksLeft = Math.max(1, openTicks - session.phaseTick + 1);
  const batch = ticksLeft <= 1 ? remaining : Math.max(1, Math.ceil(remaining / ticksLeft));
  const used = new Set(placed.map((bet) => bet.userId));
  const open = SIM_CAST.filter((person) => !used.has(person.id));

  for (const person of open.slice(0, batch)) {
    const side: BetSide = Math.random() < 0.55 ? 1 : 2;
    const amount = SIM_AMOUNTS[Math.floor(Math.random() * SIM_AMOUNTS.length)] ?? 100;
    getOrCreateDemoBalance(guildId, person.id);
    adjustDemoBalance(guildId, person.id, -amount);
    upsertDemoBet(guildId, person.id, side, amount, {
      displayName: person.name,
      simulated: true,
    });
  }
}

function toSlipBettor(bet: {
  userId: string;
  side: BetSide;
  amount: number;
  payout?: number;
  displayName?: string;
  simulated?: boolean;
}): SlipBettor {
  return {
    userId: bet.userId,
    side: bet.side,
    amount: bet.amount,
    payout: bet.payout,
    displayName: bet.displayName,
    simulated: bet.simulated,
  };
}

export function placeDemoWager(
  guildId: string,
  userId: string,
  side: BetSide,
  amount: number,
): { balance: number; teamName: string } {
  const session = getDemoSession(guildId);
  if (!session) throw new Error("No demo running. Use `/demo start` first.");
  if (session.bettingStatus !== "open") throw new Error("Demo betting is locked.");

  validateDemoWagerAmount(amount);

  const balance = getOrCreateDemoBalance(guildId, userId);
  const existing = getDemoBet(guildId, userId);
  const maxAffordable = balance + (existing?.amount ?? 0);

  if (amount > maxAffordable) {
    throw new Error(`Not enough demo credits (max **${maxAffordable}**).`);
  }

  if (existing) adjustDemoBalance(guildId, userId, existing.amount);
  adjustDemoBalance(guildId, userId, -amount);
  upsertDemoBet(guildId, userId, side, amount);

  const teamName = side === 1 ? session.team1Name : session.team2Name;
  return { balance: getOrCreateDemoBalance(guildId, userId), teamName };
}

export function cancelDemoWager(guildId: string, userId: string): number {
  const session = getDemoSession(guildId);
  if (!session) throw new Error("No demo running.");
  if (session.bettingStatus !== "open") throw new Error("Demo betting is locked.");

  const existing = getDemoBet(guildId, userId);
  if (!existing) throw new Error("No active demo wager to clear.");

  adjustDemoBalance(guildId, userId, existing.amount);
  clearDemoBet(guildId, userId);
  return getOrCreateDemoBalance(guildId, userId);
}

export async function refreshDemoBettingMessage(
  client: Client,
  guildId: string,
  scoreboard?: EmbedBuilder[],
): Promise<void> {
  const session = getDemoSession(guildId);
  if (!session?.bettingChannelId || !session.bettingMessageId) return;

  const channel = await client.channels.fetch(session.bettingChannelId).catch(() => null);
  if (!channel?.isTextBased() || channel.isDMBased()) return;

  const message = await channel.messages.fetch(session.bettingMessageId).catch(() => null);
  if (!message) return;

  const pool = getDemoPool(guildId);
  const liveBets = getDemoBets(guildId).map((bet) => toSlipBettor(bet));
  const bettors =
    session.bettingStatus === "settled"
      ? (session.settledSlip ?? liveBets).map((bet) => toSlipBettor(bet))
      : liveBets;
  const components =
    session.bettingStatus === "open"
      ? buildDemoWagerButtons(session.team1Name, session.team2Name)
      : [];

  const timing =
    session.bettingStatus === "open"
      ? "OPEN — locks the moment this match goes live."
      : session.bettingStatus === "locked"
        ? "LOCKED — no more bets. This card is the match."
        : `SETTLED — ${session.winnerSide === 1 ? session.team1Name : session.team2Name} paid.`;

  await message.edit({
    content: "",
    embeds: [
      ...(scoreboard ?? []).slice(0, 9),
      demoBettingEmbed({
        team1Name: session.team1Name,
        team2Name: session.team2Name,
        status: session.bettingStatus,
        pool,
        winnerSide: session.winnerSide,
        bettors,
        timing,
      }),
    ],
    components,
  });
}

export async function clearBettingRoom(channel: TextChannel): Promise<void> {
  const recent = await channel.messages.fetch({ limit: 25 }).catch(() => null);
  if (!recent) return;
  const mine = [...recent.values()].filter((message) => message.author.id === channel.client.user?.id);
  for (const message of mine) {
    await message.delete().catch(() => {});
  }
}

export function markDemoBettingSettled(guildId: string, winnerSide: BetSide): void {
  const session = getDemoSessionForUpdate(guildId);
  if (!session) return;
  session.bettingStatus = "settled";
  session.winnerSide = winnerSide;
}
