import { EmbedBuilder } from "discord.js";

export function settingsEmbed(settings: {
  channelId: string;
  announceMatches: boolean;
  matchReminderMinutes: number;
}): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0x95a5a6)
    .setTitle("Announcement Settings")
    .addFields(
      { name: "Channel", value: `<#${settings.channelId}>`, inline: true },
      {
        name: "Matches",
        value: settings.announceMatches ? "Enabled" : "Disabled",
        inline: true,
      },
      {
        name: "Match reminder",
        value: `${settings.matchReminderMinutes} min before start`,
        inline: true,
      },
    )
    .setDescription("Data is read from the local GGScore cache. Run `/sync` to refresh.")
    .setTimestamp(new Date());
}
