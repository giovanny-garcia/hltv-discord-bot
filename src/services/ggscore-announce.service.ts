import type { Client, EmbedBuilder, TextChannel } from "discord.js";
import type { GuildSettings } from "../types/index.js";
import {
  getAllGuildSettings,
  getSeenItem,
  getTrackedEvents,
  markReminderSent,
  markSeen,
} from "../storage/db.js";
import { filterTrackedMatches } from "../utils/event-cache.util.js";
import { getCachedUpcomingMatches } from "./ggscore-cache.service.js";
import {
  isStartingSoon,
  normalizeGgscoreMatch,
  type NormalizedGgscoreMatch,
} from "../utils/ggscore-match.util.js";
import {
  matchReminderEmbed,
  newMatchEmbed,
} from "../utils/ggscore-embeds.js";

function matchKey(id: string): string {
  return `ggscore-match:${id}`;
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
  if (!channel) return false;

  try {
    await channel.send({ embeds: [embed] });
    return true;
  } catch (error) {
    console.error(`Failed to send GGScore announcement to ${channelId}:`, error);
    return false;
  }
}

export async function announceGgscoreForGuild(
  client: Client,
  settings: GuildSettings,
  matches: NormalizedGgscoreMatch[],
): Promise<number> {
  if (!settings.announceMatches) return 0;

  const tracked = getTrackedEvents(settings.guildId);
  const eligible = filterTrackedMatches(matches, tracked);
  const { guildId, channelId } = settings;
  let announced = 0;

  for (const match of eligible) {
    const key = matchKey(match.id);
    const seen = getSeenItem(guildId, key);

    if (!seen) {
      const sent = await sendEmbed(client, channelId, newMatchEmbed(match));
      if (sent) {
        markSeen(guildId, key, "match");
        announced++;
      }
      continue;
    }

    if (
      isStartingSoon(match, settings.matchReminderMinutes) &&
      !getSeenItem(guildId, key)?.reminderSent
    ) {
      const sent = await sendEmbed(client, channelId, matchReminderEmbed(match));
      if (sent) {
        markReminderSent(guildId, key, "match");
        announced++;
      }
    }
  }

  return announced;
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
