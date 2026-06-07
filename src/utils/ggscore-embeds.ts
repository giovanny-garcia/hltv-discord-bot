import { EmbedBuilder } from "discord.js";
import type { GgscoreCountry, GgscoreSyncResult } from "../types/ggscore.js";
import type { NormalizedGgscoreMatch } from "./ggscore-match.util.js";
import { formatTimestamp, matchLabel, matchUrl } from "./ggscore-match.util.js";
import { formatCacheAge } from "../services/ggscore-cache.service.js";
import { getGgscoreCacheMeta } from "../storage/db.js";

const UPCOMING_COLOR = 0x3498db;
const RESULTS_COLOR = 0x2ecc71;
const META_COLOR = 0x95a5a6;

function matchLine(match: NormalizedGgscoreMatch, showScore = false): string {
  const label = matchLabel(match);
  const url = matchUrl(match);
  const linked = url ? `[**${label}**](${url})` : `**${label}**`;
  const when = formatTimestamp(match.scheduledAt ?? match.playedAt);
  const meta = [match.kind, match.eventName, showScore ? match.scoreLabel : when]
    .filter(Boolean)
    .join(" · ");
  return `• ${linked}${meta ? ` — ${meta}` : ""}`;
}

export function upcomingMatchesEmbed(
  matches: NormalizedGgscoreMatch[],
  cacheAge?: number,
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(UPCOMING_COLOR)
    .setTitle("Upcoming Matches (GGScore)")
    .setTimestamp(new Date());

  if (matches.length === 0) {
    embed.setDescription(
      "No cached upcoming matches. Run `/ggscore-sync scope:upcoming` or `/ggscore-sync scope:full` first.",
    );
    return embed;
  }

  embed.setDescription(matches.slice(0, 15).map((m) => matchLine(m)).join("\n"));
  if (matches.length > 15) {
    embed.setFooter({ text: `Showing 15 of ${matches.length} matches` });
  }
  if (cacheAge) {
    embed.setFooter({ text: `Cache updated ${formatCacheAge(cacheAge)}` });
  }
  return embed;
}

export function playedMatchesEmbed(
  matches: NormalizedGgscoreMatch[],
  cacheAge?: number,
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(RESULTS_COLOR)
    .setTitle("Recent Results (GGScore)")
    .setTimestamp(new Date());

  if (matches.length === 0) {
    embed.setDescription(
      "No cached results. Run `/ggscore-sync scope:results` or `/ggscore-sync scope:full` first.",
    );
    return embed;
  }

  embed.setDescription(
    matches.slice(0, 15).map((m) => matchLine(m, true)).join("\n"),
  );
  if (cacheAge) {
    embed.setFooter({ text: `Cache updated ${formatCacheAge(cacheAge)}` });
  }
  return embed;
}

export function countriesEmbed(countries: GgscoreCountry[], cacheAge?: number): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(META_COLOR)
    .setTitle("Countries (GGScore)")
    .setTimestamp(new Date());

  if (countries.length === 0) {
    embed.setDescription("No cached countries. Run `/ggscore-sync scope:countries` first.");
    return embed;
  }

  embed.setDescription(
    countries
      .slice(0, 30)
      .map((c) => `• ${c.title}`)
      .join("\n"),
  );
  if (cacheAge) {
    embed.setFooter({ text: `${countries.length} total · cache ${formatCacheAge(cacheAge)}` });
  }
  return embed;
}

export function quotaEmbed(quota: {
  date: string;
  used: number;
  limit: number;
  remaining: number;
}): EmbedBuilder {
  const meta = getGgscoreCacheMeta();
  const cacheLines =
    meta.length === 0
      ? "No cached datasets yet."
      : meta.map((entry) => `• \`${entry.key}\` — ${formatCacheAge(entry.fetchedAt)}`).join("\n");

  return new EmbedBuilder()
    .setColor(META_COLOR)
    .setTitle("GGScore API Quota")
    .addFields(
      { name: "Today (UTC)", value: quota.date, inline: true },
      { name: "Used", value: `${quota.used}/${quota.limit}`, inline: true },
      { name: "Remaining", value: String(quota.remaining), inline: true },
      { name: "Cached datasets", value: cacheLines, inline: false },
    )
    .setDescription(
      "Free tier: 3 requests/day. Use `/ggscore-sync` deliberately — all bot commands read from cache, not the live API.",
    )
    .setTimestamp(new Date());
}

export function syncResultEmbed(result: GgscoreSyncResult): EmbedBuilder {
  const fetched =
    result.fetched.length > 0
      ? result.fetched.map((key) => `• \`${key}\``).join("\n")
      : "Nothing fetched.";

  const errors =
    result.errors.length > 0
      ? result.errors.map((err) => `• ${err}`).join("\n")
      : "No errors.";

  return new EmbedBuilder()
    .setColor(result.errors.length > 0 ? 0xf39c12 : 0x2ecc71)
    .setTitle(`GGScore Sync (${result.scope})`)
    .addFields(
      { name: "Fetched", value: fetched, inline: false },
      { name: "Requests used", value: String(result.requestsUsed), inline: true },
      { name: "Remaining today", value: String(result.requestsRemaining), inline: true },
      { name: "Errors", value: errors, inline: false },
    )
    .setTimestamp(new Date());
}

export function newGgscoreMatchEmbed(match: NormalizedGgscoreMatch): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(UPCOMING_COLOR)
    .setTitle(`New Match: ${matchLabel(match)}`)
    .setDescription("A new match appeared in GGScore data.")
    .addFields(
      { name: "Scheduled", value: formatTimestamp(match.scheduledAt), inline: true },
      { name: "Format", value: match.kind ?? "TBA", inline: true },
    )
    .setTimestamp(new Date());

  if (match.eventName) embed.addFields({ name: "Event", value: match.eventName, inline: false });
  const url = matchUrl(match);
  if (url) embed.setURL(url);
  return embed;
}

export function ggscoreMatchReminderEmbed(match: NormalizedGgscoreMatch): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(0xf39c12)
    .setTitle(`Match Starting Soon: ${matchLabel(match)}`)
    .addFields({ name: "Starts", value: formatTimestamp(match.scheduledAt), inline: true })
    .setTimestamp(new Date());
  const url = matchUrl(match);
  if (url) embed.setURL(url);
  return embed;
}

export function ggscoreEventsEmbed(events: string[]): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(0x2ecc71)
    .setTitle("Events (from GGScore cache)")
    .setTimestamp(new Date());

  if (events.length === 0) {
    embed.setDescription("No events in cache yet. Sync upcoming matches first.");
    return embed;
  }

  embed.setDescription(events.slice(0, 20).map((e) => `• ${e}`).join("\n"));
  return embed;
}
