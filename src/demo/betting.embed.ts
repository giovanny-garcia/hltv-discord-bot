import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from "discord.js";
import type { BetSide } from "../types/betting.js";
import type { DemoBettingStatus, DemoPoolSummary } from "./types.js";

export interface SlipBettor {
  userId: string;
  side: BetSide;
  amount: number;
  payout?: number;
  displayName?: string;
  simulated?: boolean;
}

function bettorLabel(bet: SlipBettor): string {
  if (bet.simulated || bet.userId.startsWith("sim:")) {
    return `${bet.displayName ?? "Spectator"} (sim)`;
  }
  return `<@${bet.userId}>`;
}

function money(amount: number): string {
  return amount.toLocaleString();
}

function bettorLines(teamName: string, bets: SlipBettor[], winnerSide?: 1 | 2, side?: 1 | 2): string {
  if (bets.length === 0) return `**${teamName}**\n*No one*`;
  const lines = bets
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 12)
    .map((bet) => {
      const mark =
        winnerSide === undefined ? "•" : bet.side === winnerSide ? "✅" : "❌";
      const paid =
        bet.payout !== undefined && bet.side === winnerSide ? `  →  ${money(bet.payout)}` : "";
      return `${mark} ${bettorLabel(bet)}   **${money(bet.amount)}**${paid}`;
    });
  const more = bets.length > 12 ? `\n*+${bets.length - 12} more*` : "";
  return `**${teamName}**\n${lines.join("\n")}${more}`;
}

export function demoBettingEmbed(input: {
  team1Name: string;
  team2Name: string;
  status: DemoBettingStatus;
  pool: DemoPoolSummary;
  winnerSide?: 1 | 2;
  bettors?: SlipBettor[];
  timing?: string;
}): EmbedBuilder {
  const bettors = input.bettors ?? [];
  const team1Bets = bettors.filter((bet) => bet.side === 1);
  const team2Bets = bettors.filter((bet) => bet.side === 2);
  const team1Share =
    input.pool.totalPool > 0 ? Math.round((input.pool.team1Pool / input.pool.totalPool) * 100) : 50;
  const team2Share =
    input.pool.totalPool > 0 ? Math.round((input.pool.team2Pool / input.pool.totalPool) * 100) : 50;

  const status =
    input.status === "open"
      ? "OPEN"
      : input.status === "locked"
        ? "LOCKED"
        : "SETTLED";

  const poolLine =
    input.pool.totalPool > 0
      ? `${input.team1Name}  ${money(input.pool.team1Pool)}  (${team1Share}%)\n${input.team2Name}  ${money(input.pool.team2Pool)}  (${team2Share}%)\nTotal  ${money(input.pool.totalPool)}`
      : "No wagers yet";

  const slip =
    input.status === "open" && bettors.length === 0
      ? "Use the buttons. This message is the only thing that updates."
      : [
          bettorLines(input.team1Name, team1Bets, input.winnerSide, 1),
          "",
          bettorLines(input.team2Name, team2Bets, input.winnerSide, 2),
        ].join("\n");

  return new EmbedBuilder()
    .setColor(input.status === "open" ? 0x9b59b6 : input.status === "locked" ? 0xe67e22 : 0x2ecc71)
    .setTitle(`Bets  ·  ${status}`)
    .setDescription(
      [
        input.timing ?? (input.status === "open" ? "Locks when the match goes live." : status),
        "",
        "**Pool**",
        poolLine,
        "",
        "**Slip**",
        slip,
      ].join("\n"),
    )
    .setFooter({
      text:
        input.status === "settled"
          ? "Paid in demo credits · next match replaces this message"
          : "Buttons only · demo credits, not your real balance",
    });
}

export function buildDemoWagerButtons(team1: string, team2: string) {
  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("demo:pick:1")
      .setLabel(team1.slice(0, 80))
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("demo:pick:2")
      .setLabel(team2.slice(0, 80))
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId("demo:cancel")
      .setLabel("Clear")
      .setStyle(ButtonStyle.Secondary),
  );

  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("demo:quick:1:100").setLabel("100 · left").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("demo:quick:1:250").setLabel("250 · left").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("demo:quick:2:100").setLabel("100 · right").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("demo:quick:2:250").setLabel("250 · right").setStyle(ButtonStyle.Secondary),
  );

  return [row1, row2];
}
