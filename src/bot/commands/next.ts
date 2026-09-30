import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import type { BotCommand } from "../client.js";
import { getCachedUpcomingMatches } from "../../services/ggscore-cache.service.js";
import { getGuildSettings, getMutedEvents, getTrackedEvents } from "../../storage/db.js";
import { filterEligibleMatches } from "../../utils/event-cache.util.js";
import {
  formatTimestamp,
  matchLabel,
  matchUrl,
  normalizeGgscoreMatch,
} from "../../utils/ggscore-match.util.js";
import { formatInTimeZone } from "../../utils/time-zone.js";

export const nextCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("next")
    .setDescription("Show the next match on this server's watch list"),
  async execute(interaction) {
    if (!interaction.guildId) {
      await interaction.reply({
        content: "This command can only be used in a server.",
        ephemeral: true,
      });
      return;
    }

    const settings = getGuildSettings(interaction.guildId);
    if (!settings) {
      await interaction.reply({
        content: "Run `/setup` first so this server has a watch list.",
        ephemeral: true,
      });
      return;
    }

    const now = Date.now();
    const next = filterEligibleMatches(
      getCachedUpcomingMatches()
        .map(normalizeGgscoreMatch)
        .filter((match) => match.scheduledAt && match.scheduledAt * 1000 > now),
      settings.feedMode,
      getTrackedEvents(interaction.guildId),
      getMutedEvents(interaction.guildId),
    ).sort((a, b) => (a.scheduledAt ?? 0) - (b.scheduledAt ?? 0))[0];

    if (!next) {
      await interaction.reply({
        content: [
          "Nothing upcoming on this server's watch list.",
          "Right now the schedule has no Majors / BLAST / ESL Pro League / IEM / EWC matches.",
          "Browse what's available with `/events list`, then `/events track` for a tournament you want, or wait until the next tier-one event lands in `/setup`.",
        ].join("\n"),
        ephemeral: true,
      });
      return;
    }

    const timeZone = settings.timezone;
    const embed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle(`Next match: ${matchLabel(next)}`)
      .addFields(
        { name: "Starts", value: formatTimestamp(next.scheduledAt), inline: false },
        { name: timeZone, value: formatInTimeZone(next.scheduledAt!, timeZone), inline: true },
        { name: "Format", value: next.kind ?? "TBA", inline: true },
      )
      .setFooter({ text: "On this server's watch list · Events calendar and wagers follow this feed" })
      .setTimestamp(new Date());

    if (next.eventName) embed.addFields({ name: "Event", value: next.eventName, inline: false });
    const url = matchUrl(next);
    if (url) embed.setURL(url);

    await interaction.reply({ embeds: [embed] });
  },
};
