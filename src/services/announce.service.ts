import type { Client, EmbedBuilder, TextChannel } from "discord.js";
import type { GuildSettings } from "../types/index.js";
import {
  getAllGuildSettings,
  getSeenItem,
  markLiveAnnounced,
  markReminderSent,
  markSeen,
} from "../storage/db.js";
import type { HltvEvent, HltvMatch } from "./hltv.service.js";
import {
  matchLiveEmbed,
  matchReminderEmbed,
  newMatchEmbed,
  newTournamentEmbed,
  tournamentReminderEmbed,
} from "../utils/embeds.js";

function eventKey(id: number): string {
  return `event:${id}`;
}

function matchKey(id: number): string {
  return `match:${id}`;
}

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
  if (!channel) {
    console.warn(`Could not send to channel ${channelId}`);
    return false;
  }

  try {
    await channel.send({ embeds: [embed] });
    return true;
  } catch (error) {
    console.error(`Failed to send announcement to ${channelId}:`, error);
    return false;
  }
}

function filterEvents(events: HltvEvent[], settings: GuildSettings): HltvEvent[] {
  if (!settings.featuredOnly) return events;
  return events.filter((event) => event.featured);
}

function filterMatches(matches: HltvMatch[], settings: GuildSettings): HltvMatch[] {
  return matches.filter((match) => match.stars >= settings.minMatchStars);
}

function isTournamentStartingSoon(event: HltvEvent, settings: GuildSettings): boolean {
  if (!event.dateStart) return false;
  const now = Date.now();
  const startMs = event.dateStart * 1000;
  const windowMs = settings.tournamentReminderHours * 60 * 60 * 1000;
  return startMs > now && startMs - now <= windowMs;
}

function isMatchStartingSoon(match: HltvMatch, settings: GuildSettings): boolean {
  if (!match.date || match.live) return false;
  const now = Date.now();
  const startMs = match.date * 1000;
  const windowMs = settings.matchReminderMinutes * 60 * 1000;
  return startMs > now && startMs - now <= windowMs;
}

export async function announceForGuild(
  client: Client,
  settings: GuildSettings,
  events: HltvEvent[],
  matches: HltvMatch[],
): Promise<void> {
  const { guildId, channelId } = settings;

  if (settings.announceTournaments) {
    for (const event of filterEvents(events, settings)) {
      const key = eventKey(event.id);
      const seen = getSeenItem(guildId, key);
      let announcedNew = false;

      if (!seen) {
        const sent = await sendEmbed(client, channelId, newTournamentEmbed(event));
        if (sent) {
          markSeen(guildId, key, "event");
          announcedNew = true;
        }
      }

      if (
        !announcedNew &&
        isTournamentStartingSoon(event, settings) &&
        !getSeenItem(guildId, key)?.reminderSent
      ) {
        const sent = await sendEmbed(client, channelId, tournamentReminderEmbed(event));
        if (sent) markReminderSent(guildId, key, "event");
      }
    }
  }

  if (settings.announceMatches) {
    for (const match of filterMatches(matches, settings)) {
      const key = matchKey(match.id);
      const seen = getSeenItem(guildId, key);
      let announcedNew = false;

      if (!seen) {
        const sent = await sendEmbed(client, channelId, newMatchEmbed(match));
        if (sent) {
          markSeen(guildId, key, "match");
          announcedNew = true;
        }
      }

      if (
        !announcedNew &&
        isMatchStartingSoon(match, settings) &&
        !getSeenItem(guildId, key)?.reminderSent
      ) {
        const sent = await sendEmbed(client, channelId, matchReminderEmbed(match));
        if (sent) markReminderSent(guildId, key, "match");
      }

      if (match.live && !getSeenItem(guildId, key)?.liveAnnounced) {
        const sent = await sendEmbed(client, channelId, matchLiveEmbed(match));
        if (sent) markLiveAnnounced(guildId, key);
      }
    }
  }
}

export async function announceAllGuilds(
  client: Client,
  events: HltvEvent[],
  matches: HltvMatch[],
): Promise<void> {
  const guilds = getAllGuildSettings();
  for (const settings of guilds) {
    await announceForGuild(client, settings, events, matches);
  }
}
