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

const TEST_FOOTER = "🧪 TEST DATA · edit defaults in src/test/fixtures.ts · override via /test options";

function credits(amount: number): string {
  return `${amount.toLocaleString()} cr`;
}

function pct(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function wagersEmbed(data: TestWagerInput): EmbedBuilder {
  const team1Share = (data.team1Pool / data.totalPool) * 100;
  const team2Share = (data.team2Pool / data.totalPool) * 100;

  return new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle("💰 Wager pool")
    .setDescription(`🏆 ${data.eventName}\n**${data.team1Name}** vs **${data.team2Name}**`)
    .addFields(
      { name: "Total pool", value: credits(data.totalPool), inline: true },
      { name: "Bets placed", value: String(data.betCount), inline: true },
      { name: "Locks in", value: `${data.locksInMinutes}m`, inline: true },
      {
        name: `🔵 ${data.team1Name}`,
        value: `${credits(data.team1Pool)}\n${pct(team1Share)} of pool`,
        inline: true,
      },
      { name: "\u200b", value: "**VS**", inline: true },
      {
        name: `🔴 ${data.team2Name}`,
        value: `${credits(data.team2Pool)}\n${pct(team2Share)} of pool`,
        inline: true,
      },
    )
    .setFooter({ text: TEST_FOOTER })
    .setTimestamp(new Date());
}

export function oddsEmbed(data: TestOddsInput): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0x9b59b6)
    .setTitle("📊 Market odds")
    .setDescription("Parimutuel-style implied prices from the current pool.")
    .addFields(
      {
        name: `🔵 ${data.team1Name}`,
        value: `**${data.team1Odds.toFixed(2)}x**\nImplied ${pct(data.team1ImpliedPct)}`,
        inline: true,
      },
      { name: "\u200b", value: "**VS**", inline: true },
      {
        name: `🔴 ${data.team2Name}`,
        value: `**${data.team2Odds.toFixed(2)}x**\nImplied ${pct(data.team2ImpliedPct)}`,
        inline: true,
      },
    )
    .setFooter({ text: TEST_FOOTER })
    .setTimestamp(new Date());
}

export function payoutsEmbed(data: TestPayoutInput): EmbedBuilder {
  const lines = data.entries
    .map(
      (entry) =>
        `**${entry.username}** · wagered ${credits(entry.wagered)} → paid ${credits(entry.payout)} (**+${credits(entry.profit)}**)`,
    )
    .join("\n");

  return new EmbedBuilder()
    .setColor(0x2ecc71)
    .setTitle("🏦 Map payout")
    .setDescription(`🏆 ${data.eventName}`)
    .addFields(
      { name: "Market", value: data.marketLabel, inline: true },
      { name: "Winner", value: data.winnerName, inline: true },
      { name: "Total paid", value: credits(data.totalPaid), inline: true },
      { name: "Winners", value: lines || "No entries", inline: false },
    )
    .setFooter({ text: TEST_FOOTER })
    .setTimestamp(new Date());
}

export function rankingsEmbed(data: TestRankingsInput): EmbedBuilder {
  const lines = data.entries.map((entry) => {
    const delta = entry.delta >= 0 ? `+${entry.delta.toLocaleString()}` : entry.delta.toLocaleString();
    const medal = entry.rank === 1 ? "🥇" : entry.rank === 2 ? "🥈" : entry.rank === 3 ? "🥉" : `#${entry.rank}`;
    return `${medal} **${entry.username}** · ${credits(entry.balance)} (${delta}) · ${entry.winRate}% WR`;
  });

  return new EmbedBuilder()
    .setColor(0xf1c40f)
    .setTitle(`🏆 ${data.title}`)
    .setDescription(lines.join("\n"))
    .setFooter({ text: TEST_FOOTER })
    .setTimestamp(new Date());
}

export function streaksEmbed(data: TestStreaksInput): EmbedBuilder {
  const lines = data.entries.map((entry) => {
    const icon = entry.type === "win" ? "🔥" : "💀";
    const label = entry.type === "win" ? "win streak" : "loss streak";
    return `${icon} **${entry.username}** · ${entry.streak} ${label} · best ${entry.best}`;
  });

  return new EmbedBuilder()
    .setColor(0xe67e22)
    .setTitle("🔥 Prediction streaks")
    .setDescription(lines.join("\n"))
    .setFooter({ text: TEST_FOOTER })
    .setTimestamp(new Date());
}

export function predictionsEmbed(data: TestPredictionsInput): EmbedBuilder {
  const lines = data.entries.map((entry) => {
    const rate = ((entry.correct / entry.total) * 100).toFixed(0);
    const profit = entry.profit >= 0 ? `+${credits(entry.profit)}` : credits(entry.profit);
    return `**${entry.username}** · ${entry.correct}/${entry.total} (${rate}%) · ${profit}`;
  });

  return new EmbedBuilder()
    .setColor(0x1abc9c)
    .setTitle(`🎯 Best predictions · ${data.eventName}`)
    .setDescription(lines.join("\n"))
    .setFooter({ text: TEST_FOOTER })
    .setTimestamp(new Date());
}

export function graphEmbed(data: TestGraphInput): EmbedBuilder {
  const chartUrl = buildBalanceChartUrl(data);
  const sparkline = data.values
    .map((value, index) => {
      const prev = data.values[index - 1];
      if (index === 0) return `**${data.labels[index]}** ${value}`;
      const delta = value - prev;
      const arrow = delta > 0 ? "📈" : delta < 0 ? "📉" : "➖";
      return `**${data.labels[index]}** ${value} (${arrow}${Math.abs(delta)})`;
    })
    .join("\n");

  return new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle(`📈 ${data.title}`)
    .setDescription(`Metric: **${data.metric}**\n\n${sparkline}`)
    .setImage(chartUrl)
    .setFooter({ text: `${TEST_FOOTER} · chart via QuickChart` })
    .setTimestamp(new Date());
}
