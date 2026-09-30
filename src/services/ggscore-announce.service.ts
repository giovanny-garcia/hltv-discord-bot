import type { Client, EmbedBuilder, TextChannel } from "discord.js";
import type { GuildSettings } from "../types/index.js";
import {
  getAllGuildSettings,
  getGuildSettings,
  getMutedEvents,
  getTrackedEvents,
} from "../storage/db.js";
import { getUpcomingMatchesForEvent, filterEligibleMatches } from "../utils/event-cache.util.js";
import {
  ensureLifecycleSession,
  getLifecycleSession,
  updateLifecycleSession,
} from "../storage/lifecycle-storage.js";
import { getCachedUpcomingMatches } from "./ggscore-cache.service.js";
import {
  isPastMorningHour,
  normalizeGgscoreMatch,
  type NormalizedGgscoreMatch,
} from "../utils/ggscore-match.util.js";
import { isSameLocalDay } from "../utils/time-zone.js";
import { morningScheduleEmbed } from "../utils/ggscore-embeds.js";

async function getChannel(client: Client, channelId: string): Promise<TextChannel | null> {
  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel?.isTextBased() || channel.isDMBased()) return null;
  return channel as TextChannel;
}

async function sendEmbed(
  client: Client,
  channelId: string,
  embed: EmbedBuilder,
): Promise<boolean> {
  const channel = await getChannel(client, channelId);
  if (!channel) return false;

  try {
    await channel.send({ embeds: [embed] });
    return true;
  } catch (error) {
    console.error(`Failed to send GGScore announcement to ${channelId}:`, error);
    return false;
  }
}

function pendingMorningMatches(
  guildId: string,
  matches: NormalizedGgscoreMatch[],
  now: Date,
  timeZone: string,
): NormalizedGgscoreMatch[] {
  return matches.filter((match) => {
    if (!match.scheduledAt) return false;
    const startMs = match.scheduledAt * 1000;
    if (startMs <= now.getTime()) return false;
    if (!isSameLocalDay(new Date(startMs), now, timeZone)) return false;

    const session = getLifecycleSession(guildId, match.id);
    return !session?.morningAnnounceSent;
  });
}

export async function announceGgscoreForGuild(
  client: Client,
  settings: GuildSettings,
  matches: NormalizedGgscoreMatch[],
): Promise<number> {
  if (!settings.announceMatches) return 0;

  const now = new Date();
  if (!isPastMorningHour(now, settings.morningAnnounceHour, settings.timezone)) return 0;

  const tracked = getTrackedEvents(settings.guildId);
  const muted = getMutedEvents(settings.guildId);
  const eligible = filterEligibleMatches(matches, settings.feedMode, tracked, muted);
  const pending = pendingMorningMatches(settings.guildId, eligible, now, settings.timezone);
  if (pending.length === 0) return 0;

  const sent = await sendEmbed(client, settings.channelId, morningScheduleEmbed(pending));
  if (!sent) return 0;

  for (const match of pending) {
    const session = ensureLifecycleSession(settings.guildId, match);
    updateLifecycleSession(session.id, { morningAnnounceSent: true });
  }

  return 1;
}

export async function announceGgscoreAllGuilds(client: Client): Promise<number> {
  const raw = getCachedUpcomingMatches();
  const matches = raw.map(normalizeGgscoreMatch).filter((m) => m.scheduledAt);
  const guilds = getAllGuildSettings();

  let totalAnnounced = 0;
  for (const settings of guilds) {
    totalAnnounced += await announceGgscoreForGuild(client, settings, matches);
  }

  return totalAnnounced;
}

export async function manualAnnounceEventForGuild(
  client: Client,
  guildId: string,
  eventId: string,
  options?: { force?: boolean },
): Promise<{ sent: number; skipped: number; total: number }> {
  const settings = getGuildSettings(guildId);
  if (!settings) {
    throw new Error("Run `/setup` or `/subscribe` first to configure an announcement channel.");
  }

  const matches = getUpcomingMatchesForEvent(eventId);
  const now = new Date();
  const upcoming = matches.filter((match) => {
    if (!match.scheduledAt) return false;
    return match.scheduledAt * 1000 > now.getTime();
  });

  if (upcoming.length === 0) {
    return { sent: 0, skipped: 0, total: 0 };
  }

  if (!options?.force) {
    const alreadyAnnounced = upcoming.every((match) => {
      const session = getLifecycleSession(guildId, match.id);
      return session?.morningAnnounceSent;
    });
    if (alreadyAnnounced) {
      return { sent: 0, skipped: upcoming.length, total: upcoming.length };
    }
  }

  const ok = await sendEmbed(client, settings.channelId, morningScheduleEmbed(upcoming));
  if (!ok) {
    return { sent: 0, skipped: upcoming.length, total: upcoming.length };
  }

  for (const match of upcoming) {
    const session = ensureLifecycleSession(guildId, match);
    updateLifecycleSession(session.id, { morningAnnounceSent: true });
  }

  return { sent: 1, skipped: 0, total: upcoming.length };
}
