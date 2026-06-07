import type { Client, EmbedBuilder, TextChannel } from "discord.js";
import type { GuildSettings } from "../types/index.js";
import {
  getAllGuildSettings,
  getSeenItem,
  markReminderSent,
  markSeen,
} from "../storage/db.js";
import { getCachedUpcomingMatches } from "./ggscore-cache.service.js";
import {
  isStartingSoon,
  normalizeGgscoreMatch,
  type NormalizedGgscoreMatch,
} from "../utils/ggscore-match.util.js";
import {
  ggscoreMatchReminderEmbed,
  newGgscoreMatchEmbed,
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
): Promise<void> {
  if (!settings.announceMatches) return;

  const { guildId, channelId } = settings;

  for (const match of matches) {
    const key = matchKey(match.id);
    const seen = getSeenItem(guildId, key);
    let announcedNew = false;

    if (!seen) {
      const sent = await sendEmbed(client, channelId, newGgscoreMatchEmbed(match));
      if (sent) {
        markSeen(guildId, key, "match");
        announcedNew = true;
      }
    }

    if (
      !announcedNew &&
      isStartingSoon(match, settings.matchReminderMinutes) &&
      !getSeenItem(guildId, key)?.reminderSent
    ) {
      const sent = await sendEmbed(client, channelId, ggscoreMatchReminderEmbed(match));
      if (sent) markReminderSent(guildId, key, "match");
    }
  }
}

export async function announceGgscoreAllGuilds(client: Client): Promise<number> {
  const raw = getCachedUpcomingMatches();
  const matches = raw.map(normalizeGgscoreMatch).filter((m) => m.scheduledAt);
  const guilds = getAllGuildSettings();

  for (const settings of guilds) {
    await announceGgscoreForGuild(client, settings, matches);
  }

  return matches.length;
}
