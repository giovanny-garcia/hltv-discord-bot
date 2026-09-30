import {
  DiscordAPIError,
  GuildScheduledEventEntityType,
  GuildScheduledEventPrivacyLevel,
  PermissionFlagsBits,
  type Client,
} from "discord.js";
import type { GuildSettings } from "../types/index.js";
import {
  deleteCalendarEvent,
  listCalendarEvents,
  saveCalendarEvent,
  type CalendarEventRow,
} from "../storage/calendar-storage.js";
import type { NormalizedGgscoreMatch } from "../utils/ggscore-match.util.js";

const loggedPermissionDenials = new Set<string>();

function clip(value: string, max: number): string {
  const trimmed = value.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

function durationMs(kind?: string): number {
  const format = (kind ?? "").toLowerCase();
  if (format.includes("bo1")) return 75 * 60_000;
  if (format.includes("bo5")) return 5 * 60 * 60_000;
  if (format.includes("bo3")) return 3 * 60 * 60_000;
  return 2 * 60 * 60_000;
}

function eventName(match: NormalizedGgscoreMatch): string {
  return clip(`${match.team1Name} vs ${match.team2Name}`, 100);
}

function eventLocation(match: NormalizedGgscoreMatch): string {
  return clip(match.eventName || match.location || "Counter-Strike 2", 100);
}

function eventDescription(match: NormalizedGgscoreMatch): string {
  const lines = [
    match.eventName,
    match.kind ? match.kind.toUpperCase() : undefined,
    match.location,
    match.matchLink,
  ].filter((line): line is string => Boolean(line));
  return clip(lines.join("\n"), 1000);
}

function isFutureMatch(match: NormalizedGgscoreMatch, now: number): boolean {
  if (!match.scheduledAt) return false;
  if (match.team1Name === "TBD" && match.team2Name === "TBD") return false;
  return match.scheduledAt * 1000 > now + 60_000;
}

function sameSlot(row: CalendarEventRow, match: NormalizedGgscoreMatch): boolean {
  return row.scheduledAt === match.scheduledAt && row.name === eventName(match);
}

export async function syncCalendarForGuild(
  client: Client,
  settings: GuildSettings,
  matches: NormalizedGgscoreMatch[],
): Promise<number> {
  const now = Date.now();
  const wanted = matches.filter((match) => isFutureMatch(match, now));
  const stored = listCalendarEvents(settings.guildId);
  const storedByMatch = new Map(stored.map((row) => [row.matchId, row]));
  const wantedIds = new Set(wanted.map((match) => match.id));

  const stale = stored.filter(
    (row) => !wantedIds.has(row.matchId) && row.scheduledAt * 1000 > now,
  );
  const toCreate = wanted.filter((match) => !storedByMatch.has(match.id));
  const toUpdate = wanted.filter((match) => {
    const row = storedByMatch.get(match.id);
    return row !== undefined && !sameSlot(row, match);
  });

  if (stale.length === 0 && toCreate.length === 0 && toUpdate.length === 0) return 0;

  const guild = await client.guilds.fetch(settings.guildId);
  const me = guild.members.me ?? (await guild.members.fetchMe());
  if (!me.permissions.has(PermissionFlagsBits.CreateEvents)) {
    if (!loggedPermissionDenials.has(settings.guildId)) {
      loggedPermissionDenials.add(settings.guildId);
      console.warn(
        `Calendar sync skipped for ${guild.name}: give the bot the Create Events permission.`,
      );
    }
    return 0;
  }
  loggedPermissionDenials.delete(settings.guildId);

  let changed = 0;

  for (const row of stale) {
    try {
      await guild.scheduledEvents.delete(row.discordEventId);
    } catch (error) {
      if (!(error instanceof DiscordAPIError) || error.code !== 10070) {
        console.error(`Failed to remove calendar event ${row.discordEventId}:`, error);
        continue;
      }
    }
    deleteCalendarEvent(settings.guildId, row.matchId);
    changed += 1;
  }

  for (const match of toUpdate) {
    const row = storedByMatch.get(match.id);
    if (!row || !match.scheduledAt) continue;
    const start = new Date(match.scheduledAt * 1000);
    try {
      await guild.scheduledEvents.edit(row.discordEventId, {
        name: eventName(match),
        scheduledStartTime: start,
        scheduledEndTime: new Date(start.getTime() + durationMs(match.kind)),
        description: eventDescription(match),
        entityMetadata: { location: eventLocation(match) },
      });
      saveCalendarEvent({
        ...row,
        scheduledAt: match.scheduledAt,
        name: eventName(match),
      });
      changed += 1;
    } catch (error) {
      if (error instanceof DiscordAPIError && error.code === 10070) {
        deleteCalendarEvent(settings.guildId, match.id);
        toCreate.push(match);
        continue;
      }
      console.error(`Failed to update calendar event for ${eventName(match)}:`, error);
    }
  }

  for (const match of toCreate) {
    if (!match.scheduledAt) continue;
    const start = new Date(match.scheduledAt * 1000);
    try {
      const created = await guild.scheduledEvents.create({
        name: eventName(match),
        scheduledStartTime: start,
        scheduledEndTime: new Date(start.getTime() + durationMs(match.kind)),
        privacyLevel: GuildScheduledEventPrivacyLevel.GuildOnly,
        entityType: GuildScheduledEventEntityType.External,
        description: eventDescription(match),
        entityMetadata: { location: eventLocation(match) },
        reason: "Upcoming tracked CS2 match",
      });
      saveCalendarEvent({
        guildId: settings.guildId,
        matchId: match.id,
        discordEventId: created.id,
        scheduledAt: match.scheduledAt,
        name: eventName(match),
      });
      changed += 1;
    } catch (error) {
      console.error(`Failed to create calendar event for ${eventName(match)}:`, error);
    }
  }

  if (changed > 0) {
    console.log(`Calendar sync for ${guild.name}: ${changed} event(s) updated`);
  }

  return changed;
}
