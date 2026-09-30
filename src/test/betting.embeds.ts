import { EmbedBuilder } from "discord.js";
import type {
  TestGraphInput,
  TestOddsInput,
  TestPayoutInput,
  TestPredictionsInput,
  TestRankingsInput,
  TestStreaksInput,
  TestWagerInput,
} from "./types.js";
import { buildBalanceChartUrl } from "./graph.util.js";
import {
  RULE,
  credits,
  deltaText,
  listBlock,
  medalForRank,
  pct,
  sectionLabel,
  statLine,
  symmetricalMatchup,
  vsBlock,
} from "../utils/embed-format.js";

const TEST_FOOTER = "🧪 TEST · edit src/test/fixtures.ts · override with /test options";

export function wagersEmbed(data: TestWagerInput): EmbedBuilder {
  const team1Share = (data.team1Pool / data.totalPool) * 100;
  const team2Share = (data.team2Pool / data.totalPool) * 100;

  const poolBlock = symmetricalMatchup({
    leftBadge: "🔵",
    leftName: data.team1Name,
    leftSeries: credits(data.team1Pool),
    leftSub: pct(team1Share) + " of pool",
    rightBadge: "🔴",
    rightName: data.team2Name,
    rightSeries: credits(data.team2Pool),
    rightSub: pct(team2Share) + " of pool",
    centerLabel: "POOL",
  });

  return new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle("💰 WAGER POOL")
    .setDescription(
      [
        `# **${data.totalPool.toLocaleString()}** credits`,
        vsBlock(data.eventName),
        poolBlock,
        "",
        statLine("Bets placed", String(data.betCount)),
        statLine("Locks in", `${data.locksInMinutes} minutes`),
      ].join("\n"),
    )
    .setFooter({ text: TEST_FOOTER })
    .setTimestamp(new Date());
}

export function oddsEmbed(data: TestOddsInput): EmbedBuilder {
  const block = symmetricalMatchup({
    leftBadge: "🔵",
    leftName: data.team1Name,
    leftSeries: `# **${data.team1Odds.toFixed(2)}x**`,
    leftSub: `Implied ${pct(data.team1ImpliedPct)}`,
    rightBadge: "🔴",
    rightName: data.team2Name,
    rightSeries: `# **${data.team2Odds.toFixed(2)}x**`,
    rightSub: `Implied ${pct(data.team2ImpliedPct)}`,
    centerLabel: "ODDS",
  });

  return new EmbedBuilder()
    .setColor(0x9b59b6)
    .setTitle("📊 MARKET ODDS")
    .setDescription(
      [
        sectionLabel("Parimutuel prices"),
        vsBlock(`${data.team1Name} vs ${data.team2Name}`),
        block,
      ].join("\n"),
    )
    .setFooter({ text: TEST_FOOTER })
    .setTimestamp(new Date());
}

export function payoutsEmbed(data: TestPayoutInput): EmbedBuilder {
  const lines = data.entries.map(
    (entry) =>
      `**${entry.username.toUpperCase()}**\nWagered ${credits(entry.wagered)} → Paid ${credits(entry.payout)}\nProfit **+${entry.profit.toLocaleString()} cr**`,
  );

  return new EmbedBuilder()
    .setColor(0x2ecc71)
    .setTitle("🏦 MAP PAYOUT")
    .setDescription(
      [
        vsBlock(data.eventName),
        statLine("Market", data.marketLabel),
        statLine("Winner", data.winnerName),
        statLine("Total paid", credits(data.totalPaid)),
        "",
        sectionLabel("Winners"),
        listBlock(lines),
      ].join("\n"),
    )
    .setFooter({ text: TEST_FOOTER })
    .setTimestamp(new Date());
}

export function rankingsEmbed(data: TestRankingsInput): EmbedBuilder {
  const lines = data.entries.map((entry) => {
    return `${medalForRank(entry.rank)}  **${entry.username.toUpperCase()}**\n${credits(entry.balance)}  ·  ${deltaText(entry.delta)}  ·  **${entry.winRate}%** win rate`;
  });

  return new EmbedBuilder()
    .setColor(0xf1c40f)
    .setTitle(`🏆 ${data.title.toUpperCase()}`)
    .setDescription([sectionLabel("Standings"), "", listBlock(lines)].join("\n"))
    .setFooter({ text: TEST_FOOTER })
    .setTimestamp(new Date());
}

export function streaksEmbed(data: TestStreaksInput): EmbedBuilder {
  const lines = data.entries.map((entry) => {
    const icon = entry.type === "win" ? "🔥" : "💀";
    const label = entry.type === "win" ? "WIN STREAK" : "LOSS STREAK";
    return `${icon}  **${entry.username.toUpperCase()}**\n# **${entry.streak}**  ${label}\nBest streak **${entry.best}**`;
  });

  return new EmbedBuilder()
    .setColor(0xe67e22)
    .setTitle("🔥 PREDICTION STREAKS")
    .setDescription([sectionLabel("Active streaks"), "", listBlock(lines)].join("\n"))
    .setFooter({ text: TEST_FOOTER })
    .setTimestamp(new Date());
}

export function predictionsEmbed(data: TestPredictionsInput): EmbedBuilder {
  const lines = data.entries.map((entry) => {
    const rate = ((entry.correct / entry.total) * 100).toFixed(0);
    const profit =
      entry.profit >= 0
        ? `+${entry.profit.toLocaleString()} cr`
        : `${entry.profit.toLocaleString()} cr`;
    return `**${entry.username.toUpperCase()}**\n# **${entry.correct}/${entry.total}**  (${rate}% correct)\nProfit **${profit}**`;
  });

  return new EmbedBuilder()
    .setColor(0x1abc9c)
    .setTitle(`🎯 EVENT PREDICTIONS`)
    .setDescription(
      [vsBlock(data.eventName), sectionLabel("Top predictors"), "", listBlock(lines)].join("\n"),
    )
    .setFooter({ text: TEST_FOOTER })
    .setTimestamp(new Date());
}

export function graphEmbed(data: TestGraphInput): EmbedBuilder {
  const chartUrl = buildBalanceChartUrl(data);
  const latest = data.values.at(-1) ?? 0;
  const first = data.values[0] ?? 0;
  const change = latest - first;

  const sparkline = data.values
    .map((value, index) => {
      const label = data.labels[index] ?? `P${index + 1}`;
      return `**${label}**  →  **${value.toLocaleString()}**`;
    })
    .join("\n");

  return new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle(`📈 ${data.title.toUpperCase()}`)
    .setDescription(
      [
        statLine("Metric", data.metric),
        statLine("Latest", latest.toLocaleString()),
        statLine("Change", `${change >= 0 ? "+" : ""}${change.toLocaleString()}`),
        "",
        RULE,
        sparkline,
      ].join("\n"),
    )
    .setImage(chartUrl)
    .setFooter({ text: `${TEST_FOOTER} · chart via QuickChart` })
    .setTimestamp(new Date());
}

export function testPreviewHeader(title: string): string {
  return `# 🧪 TEST PREVIEW\n## ${title}`;
}
