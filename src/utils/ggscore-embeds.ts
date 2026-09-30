import { EmbedBuilder } from "discord.js";
import { isTierOneEvent, TIER_ONE_LABELS } from "./tier-one.js";
import type { GgscoreCountry, GgscoreSyncResult } from "../types/ggscore.js";
import type { NormalizedGgscoreMatch } from "./ggscore-match.util.js";
import { formatTimestamp, formatCountdown, matchLabel, matchUrl } from "./ggscore-match.util.js";
import { formatCacheAge, getUpcomingScheduleHorizon } from "../services/ggscore-cache.service.js";
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
    .setTitle("Upcoming Matches")
    .setTimestamp(new Date());

  if (matches.length === 0) {
    embed.setDescription(
      "No cached upcoming matches. Run `/sync scope:upcoming` or `/sync scope:full` first.",
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
    .setTitle("Recent Results")
    .setTimestamp(new Date());

  if (matches.length === 0) {
    embed.setDescription(
      "No cached results. Run `/sync scope:results` or `/sync scope:full` first.",
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
    .setTitle("Countries")
    .setTimestamp(new Date());

  if (countries.length === 0) {
    embed.setDescription("No cached countries. Run `/sync scope:countries` first.");
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

export function quotaEmbed(
  quota: {
    date: string;
    used: number;
    limit: number;
    remaining: number;
  },
  caps: {
    maxUpcomingPages: number;
    reserveCalls: number;
    manualHeavySyncsPerDay: number;
    manualHeavySyncsUsed: number;
  },
): EmbedBuilder {
  const meta = getGgscoreCacheMeta();
  const cacheLines =
    meta.length === 0
      ? "No cached datasets yet."
      : meta.map((entry) => `• \`${entry.key}\` — ${formatCacheAge(entry.fetchedAt)}`).join("\n");
  const pageLabel = `${caps.maxUpcomingPages} page${caps.maxUpcomingPages === 1 ? "" : "s"}`;
  const reserveLabel = `${caps.reserveCalls} call${caps.reserveCalls === 1 ? "" : "s"}`;

  return new EmbedBuilder()
    .setColor(META_COLOR)
    .setTitle("GGScore API Quota")
    .addFields(
      { name: "Today (UTC)", value: quota.date, inline: true },
      { name: "Used", value: `${quota.used}/${quota.limit}`, inline: true },
      { name: "Remaining", value: String(quota.remaining), inline: true },
      {
        name: "Manual schedule syncs",
        value: `${caps.manualHeavySyncsUsed}/${caps.manualHeavySyncsPerDay} today`,
        inline: true,
      },
      { name: "Cached datasets", value: cacheLines, inline: false },
    )
    .setDescription(
      `Upcoming and full syncs are capped at ${pageLabel} and leave ${reserveLabel} so results can still be refreshed with \`/sync scope:results\`.`,
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
    .setTitle(`Sync Complete (${result.scope})`)
    .addFields(
      { name: "Fetched", value: fetched, inline: false },
      ...(result.horizon
        ? [{ name: "Schedule window", value: result.horizon, inline: false }]
        : []),
      { name: "Requests used", value: String(result.requestsUsed), inline: true },
      { name: "Remaining today", value: String(result.requestsRemaining), inline: true },
      { name: "Errors", value: errors, inline: false },
    )
    .setTimestamp(new Date());
}

export function morningScheduleEmbed(matches: NormalizedGgscoreMatch[]): EmbedBuilder {
  const sorted = [...matches].sort(
    (a, b) => (a.scheduledAt ?? 0) - (b.scheduledAt ?? 0),
  );
  const dateLabel = sorted[0]?.scheduledAt
    ? `<t:${sorted[0].scheduledAt}:D>`
    : "Today";

  const lines = sorted.map((match) => {
    const label = matchLabel(match);
    const url = matchUrl(match);
    const linked = url ? `[**${label}**](${url})` : `**${label}**`;
    const meta = [match.kind, match.eventName].filter(Boolean).join(" · ");
    const countdown = formatCountdown(match.scheduledAt);
    return meta
      ? `• ${linked} — ${meta}\n  ${countdown}`
      : `• ${linked}\n  ${countdown}`;
  });

  return new EmbedBuilder()
    .setColor(UPCOMING_COLOR)
    .setTitle(`Today's Matches — ${dateLabel}`)
    .setDescription(lines.join("\n\n"))
    .setFooter({ text: "Countdowns update automatically in Discord" })
    .setTimestamp(new Date());
}

export function matchStartEmbed(match: NormalizedGgscoreMatch): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(0xed4245)
    .setTitle(`🔴 Match Started: ${matchLabel(match)}`)
    .setDescription(`Live now — check the scorecard above for updates.`)
    .addFields(
      { name: "Started", value: formatTimestamp(match.scheduledAt), inline: true },
      { name: "Format", value: match.kind ?? "TBA", inline: true },
    )
    .setTimestamp(new Date());

  if (match.eventName) embed.addFields({ name: "Event", value: match.eventName, inline: false });
  const url = matchUrl(match);
  if (url) embed.setURL(url);
  return embed;
}

export function newMatchEmbed(match: NormalizedGgscoreMatch): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(UPCOMING_COLOR)
    .setTitle(`New Match: ${matchLabel(match)}`)
    .setDescription("A new upcoming match was added to the cache.")
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

export function matchReminderEmbed(match: NormalizedGgscoreMatch): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(0xf39c12)
    .setTitle(`Match Starting Soon: ${matchLabel(match)}`)
    .addFields({ name: "Starts", value: formatTimestamp(match.scheduledAt), inline: true })
    .setTimestamp(new Date());
  const url = matchUrl(match);
  if (url) embed.setURL(url);
  return embed;
}

export function eventsEmbed(events: string[]): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(0x2ecc71)
    .setTitle("Events")
    .setTimestamp(new Date());

  if (events.length === 0) {
    embed.setDescription("No events in cache yet. Run `/sync scope:full` to populate data.");
    return embed;
  }

  embed.setDescription(events.slice(0, 20).map((e) => `• ${e}`).join("\n"));
  return embed;
}

export function cachedEventsEmbed(
  events: { id: string; name: string; upcomingCount: number }[],
  trackedIds: Set<string>,
  mutedIds: Set<string> = new Set(),
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(0x2ecc71)
    .setTitle("Cached Events")
    .setTimestamp(new Date());

  if (events.length === 0) {
    embed.setDescription("No events in cache yet. Run `/setup` to load the schedule.");
    return embed;
  }

  const lines = events.slice(0, 25).map((event) => {
    const muted = mutedIds.has(event.id);
    const tierOne = isTierOneEvent(event.name);
    const extra = trackedIds.has(event.id);
    const mark = muted ? "🚫 " : tierOne ? "⭐ " : extra ? "📌 " : "· ";
    const upcoming =
      event.upcomingCount > 0 ? ` · ${event.upcomingCount} upcoming` : "";
    return `${mark}**${event.name}**${upcoming}`;
  });

  const hasTierOne = events.some((event) => isTierOneEvent(event.name));
  const horizon = getUpcomingScheduleHorizon();
  const intro = hasTierOne
    ? [
        horizon ? `Window: ${horizon}` : null,
        "⭐ = default tier-one feed · 📌 = you added · 🚫 = hidden",
      ]
        .filter(Boolean)
        .join("\n")
    : [
        horizon ? `Window: ${horizon}` : null,
        "No **⭐ tier-one** events are in this window.",
        "Default feed includes: Majors, BLAST, ESL Pro League, IEM, EWC.",
        "📌 = you added · 🚫 = hidden · `/events defaults` for the full list.",
      ]
        .filter(Boolean)
        .join("\n");

  embed.setDescription([intro, "", ...lines].join("\n"));
  embed.setFooter({
    text: "/events track to add · /events untrack to hide · /events defaults for tier-one rules",
  });
  return embed;
}

export function tierOneDefaultsEmbed(
  upcomingTierOne: { name: string; upcomingCount: number }[],
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(0xf1c40f)
    .setTitle("Default tier-one feed")
    .setDescription(
      [
        "After `/setup` or `/events reset`, these tournaments are included automatically:",
        "",
        ...TIER_ONE_LABELS.map((label) => `⭐ ${label}`),
        "",
        "Everything else needs `/events track`. ESL Challenger is **not** ESL Pro League.",
      ].join("\n"),
    )
    .setTimestamp(new Date());

  if (upcomingTierOne.length === 0) {
    embed.addFields({
      name: "On the schedule now",
      value: "None in the current cache. Check again after `/setup` refreshes, or add a tournament with `/events track`.",
    });
  } else {
    embed.addFields({
      name: "On the schedule now",
      value: upcomingTierOne
        .map((event) => `⭐ **${event.name}** · ${event.upcomingCount} upcoming`)
        .join("\n"),
    });
  }

  return embed;
}

export function trackedEventsEmbed(
  tracked: { eventName: string; upcomingCount?: number }[],
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle("Tracked Events")
    .setTimestamp(new Date());

  if (tracked.length === 0) {
    embed.setDescription(
      "No extra events.\n\nMajors, BLAST, ESL Pro League, and IEM are included on their own. Use `/events track` to add anything else.",
    );
    return embed;
  }

  embed.setDescription(
    tracked
      .map((event) => {
        const upcoming =
          event.upcomingCount && event.upcomingCount > 0
            ? ` · ${event.upcomingCount} upcoming`
            : "";
        return `📌 **${event.eventName}**${upcoming}`;
      })
      .join("\n"),
  );
  embed.setFooter({ text: "Extra events, on top of the tier-one feed" });
  return embed;
}
