import { EmbedBuilder } from "discord.js";

export function settingsEmbed(settings: {
  channelId: string;
  announceMatches: boolean;
  matchReminderMinutes: number;
  trackedEventCount?: number;
}): EmbedBuilder {
  const tracked =
    settings.trackedEventCount === undefined
      ? null
      : settings.trackedEventCount === 0
        ? "None — announcements paused"
        : `${settings.trackedEventCount} event(s)`;

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
      ...(tracked
        ? [{ name: "Tracked events", value: tracked, inline: false }]
        : []),
    )
    .setDescription(
      "Only matches from **tracked events** are announced. Use `/events track` to pick tournaments.",
    )
    .setTimestamp(new Date());
}
