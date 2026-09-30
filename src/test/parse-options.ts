import type { ChatInputCommandInteraction } from "discord.js";
import type {
  TestGraphInput,
  TestMatchInput,
  TestOddsInput,
  TestPayoutInput,
  TestPredictionsInput,
  TestRankingsInput,
  TestStreaksInput,
  TestWagerInput,
} from "./types.js";
import { TEAM1_COLOR, TEAM2_COLOR } from "./fixtures.js";

export function parseJsonOverride<T extends object>(
  json: string | null,
  base: T,
): T {
  if (!json?.trim()) return base;
  try {
    return { ...base, ...JSON.parse(json) as Partial<T> };
  } catch {
    throw new Error("Invalid JSON override. Check syntax and try again.");
  }
}

export function parseRankedList(
  raw: string | null,
  parser: (chunk: string) => unknown,
): unknown[] | undefined {
  if (!raw?.trim()) return undefined;
  return raw.split(",").map((chunk) => parser(chunk.trim()));
}

function parseKeyValues(chunk: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of chunk.split("|")) {
    const [key, value] = part.split(":").map((s) => s.trim());
    if (key && value !== undefined) out[key] = value;
  }
  return out;
}

export function applyMatchOptions(
  interaction: ChatInputCommandInteraction,
  base: TestMatchInput,
): TestMatchInput {
  const team1 = interaction.options.getString("team1");
  const team2 = interaction.options.getString("team2");
  const event = interaction.options.getString("event");
  const format = interaction.options.getString("format");
  const map = interaction.options.getInteger("map");
  const series1 = interaction.options.getInteger("series1");
  const series2 = interaction.options.getInteger("series2");
  const mapscore1 = interaction.options.getInteger("mapscore1");
  const mapscore2 = interaction.options.getInteger("mapscore2");
  const startsIn = interaction.options.getInteger("starts_in_minutes");
  const hideSpoilers = interaction.options.getBoolean("hide_spoilers");
  const winner = interaction.options.getString("winner");

  let merged: TestMatchInput = {
    ...base,
    team1: { ...base.team1 },
    team2: { ...base.team2 },
  };

  if (team1) merged.team1.name = team1;
  if (team2) merged.team2.name = team2;
  if (event) merged.eventName = event;
  if (format) merged.format = format;
  if (map !== null) merged.currentMap = map;
  if (series1 !== null) merged.team1.seriesScore = series1;
  if (series2 !== null) merged.team2.seriesScore = series2;
  if (mapscore1 !== null) merged.team1.mapScore = mapscore1;
  if (mapscore2 !== null) merged.team2.mapScore = mapscore2;
  if (startsIn !== null) merged.scheduledInMinutes = startsIn;
  if (hideSpoilers !== null) merged.hideSpoilers = hideSpoilers;
  if (winner === "team1") merged.winnerSide = 1;
  if (winner === "team2") merged.winnerSide = 2;

  const json = interaction.options.getString("json");
  merged = parseJsonOverride(json, merged);

  return merged;
}

export function applyWagerOptions(
  interaction: ChatInputCommandInteraction,
  base: TestWagerInput,
): TestWagerInput {
  const merged = parseJsonOverride(
    interaction.options.getString("json"),
    {
      ...base,
      team1Name: interaction.options.getString("team1") ?? base.team1Name,
      team2Name: interaction.options.getString("team2") ?? base.team2Name,
      eventName: interaction.options.getString("event") ?? base.eventName,
      totalPool: interaction.options.getInteger("pool_total") ?? base.totalPool,
      team1Pool: interaction.options.getInteger("team1_pool") ?? base.team1Pool,
      team2Pool: interaction.options.getInteger("team2_pool") ?? base.team2Pool,
      betCount: interaction.options.getInteger("bet_count") ?? base.betCount,
      locksInMinutes: interaction.options.getInteger("locks_in_minutes") ?? base.locksInMinutes,
    },
  );
  return merged;
}

export function applyOddsOptions(
  interaction: ChatInputCommandInteraction,
  base: TestOddsInput,
): TestOddsInput {
  return parseJsonOverride(interaction.options.getString("json"), {
    ...base,
    team1Name: interaction.options.getString("team1") ?? base.team1Name,
    team2Name: interaction.options.getString("team2") ?? base.team2Name,
    team1Odds: interaction.options.getNumber("team1_odds") ?? base.team1Odds,
    team2Odds: interaction.options.getNumber("team2_odds") ?? base.team2Odds,
    team1ImpliedPct: interaction.options.getNumber("team1_pct") ?? base.team1ImpliedPct,
    team2ImpliedPct: interaction.options.getNumber("team2_pct") ?? base.team2ImpliedPct,
  });
}

export function applyPayoutOptions(
  interaction: ChatInputCommandInteraction,
  base: TestPayoutInput,
): TestPayoutInput {
  const entriesRaw = interaction.options.getString("entries");
  const entries = parseRankedList(entriesRaw, (chunk) => {
    const p = parseKeyValues(chunk);
    return {
      username: p.user ?? "Player",
      wagered: Number(p.wagered ?? 0),
      payout: Number(p.payout ?? 0),
      profit: Number(p.profit ?? 0),
    };
  });

  return parseJsonOverride(interaction.options.getString("json"), {
    ...base,
    eventName: interaction.options.getString("event") ?? base.eventName,
    marketLabel: interaction.options.getString("market") ?? base.marketLabel,
    winnerName: interaction.options.getString("winner") ?? base.winnerName,
    totalPaid: interaction.options.getInteger("total_paid") ?? base.totalPaid,
    entries: (entries as TestPayoutInput["entries"]) ?? base.entries,
  });
}

export function applyRankingsOptions(
  interaction: ChatInputCommandInteraction,
  base: TestRankingsInput,
): TestRankingsInput {
  const entriesRaw = interaction.options.getString("entries");
  const entries = parseRankedList(entriesRaw, (chunk) => {
    const p = parseKeyValues(chunk);
    return {
      rank: Number(p.rank ?? 0),
      username: p.user ?? "Player",
      balance: Number(p.balance ?? 0),
      delta: Number(p.delta ?? 0),
      winRate: Number(p.winrate ?? 0),
    };
  });

  return parseJsonOverride(interaction.options.getString("json"), {
    ...base,
    title: interaction.options.getString("title") ?? base.title,
    entries: (entries as TestRankingsInput["entries"]) ?? base.entries,
  });
}

export function applyStreaksOptions(
  interaction: ChatInputCommandInteraction,
  base: TestStreaksInput,
): TestStreaksInput {
  const entriesRaw = interaction.options.getString("entries");
  const entries = parseRankedList(entriesRaw, (chunk) => {
    const p = parseKeyValues(chunk);
    return {
      username: p.user ?? "Player",
      streak: Number(p.streak ?? 0),
      type: (p.type === "loss" ? "loss" : "win") as "win" | "loss",
      best: Number(p.best ?? 0),
    };
  });

  return parseJsonOverride(interaction.options.getString("json"), {
    ...base,
    entries: (entries as TestStreaksInput["entries"]) ?? base.entries,
  });
}

export function applyPredictionsOptions(
  interaction: ChatInputCommandInteraction,
  base: TestPredictionsInput,
): TestPredictionsInput {
  const entriesRaw = interaction.options.getString("entries");
  const entries = parseRankedList(entriesRaw, (chunk) => {
    const p = parseKeyValues(chunk);
    return {
      username: p.user ?? "Player",
      correct: Number(p.correct ?? 0),
      total: Number(p.total ?? 0),
      profit: Number(p.profit ?? 0),
    };
  });

  return parseJsonOverride(interaction.options.getString("json"), {
    ...base,
    eventName: interaction.options.getString("event") ?? base.eventName,
    entries: (entries as TestPredictionsInput["entries"]) ?? base.entries,
  });
}

export function applyGraphOptions(
  interaction: ChatInputCommandInteraction,
  base: TestGraphInput,
): TestGraphInput {
  const labels = interaction.options.getString("labels");
  const values = interaction.options.getString("values");

  return parseJsonOverride(interaction.options.getString("json"), {
    ...base,
    title: interaction.options.getString("title") ?? base.title,
    metric: interaction.options.getString("metric") ?? base.metric,
    labels: labels ? labels.split(",").map((s) => s.trim()) : base.labels,
    values: values
      ? values.split(",").map((s) => Number(s.trim())).filter((n) => !Number.isNaN(n))
      : base.values,
  });
}

export function teamColorFromName(name: string, side: 1 | 2): number {
  void name;
  return side === 1 ? TEAM1_COLOR : TEAM2_COLOR;
}
