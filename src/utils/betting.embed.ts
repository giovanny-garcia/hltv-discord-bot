import { EmbedBuilder } from "discord.js";
import type { BetMarket, MarketPoolSummary } from "../types/betting.js";
import { credits, symmetricalMatchup } from "./embed-format.js";

export function openMarketEmbed(
  market: BetMarket,
  pool: MarketPoolSummary,
): EmbedBuilder {
  const team1Share = pool.totalPool > 0 ? (pool.team1Pool / pool.totalPool) * 100 : 50;
  const team2Share = pool.totalPool > 0 ? (pool.team2Pool / pool.totalPool) * 100 : 50;

  const statusLabel =
    market.status === "open"
      ? "🟢 **BETTING OPEN**"
      : market.status === "locked"
        ? "🔒 **BETTING LOCKED**"
        : "✅ **SETTLED**";

  const poolBlock =
    pool.totalPool > 0
      ? symmetricalMatchup({
          leftBadge: "🔵",
          leftName: market.team1Name,
          leftSeries: credits(pool.team1Pool),
          leftSub: `${team1Share.toFixed(0)}% of pool`,
          rightBadge: "🔴",
          rightName: market.team2Name,
          rightSeries: credits(pool.team2Pool),
          rightSub: `${team2Share.toFixed(0)}% of pool`,
          centerLabel: "POOL",
        })
      : "*No wagers yet — be the first!*";

  return new EmbedBuilder()
    .setColor(market.status === "open" ? 0x2ecc71 : 0x95a5a6)
    .setTitle(`${market.team1Name} vs ${market.team2Name}`)
    .setDescription(
      [
        statusLabel,
        market.eventName ? `🏆 **${market.eventName}**` : null,
        market.format ? `Format · **${market.format}**` : null,
        "",
        poolBlock,
        "",
        pool.betCount > 0
          ? `**${pool.betCount}** wager${pool.betCount === 1 ? "" : "s"} · Total ${credits(pool.totalPool)}`
          : "Use the buttons below to wager credits.",
        market.status === "open"
          ? "\n*You can change your wager until an admin locks betting.*"
          : null,
      ]
        .filter(Boolean)
        .join("\n"),
    )
    .setFooter({ text: `Market #${market.id} · /balance to check credits` })
    .setTimestamp(new Date());
}
