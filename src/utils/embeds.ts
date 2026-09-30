import { EmbedBuilder } from "discord.js";

export function settingsEmbed(settings: {
  channelId: string;
  announceMatches: boolean;
  morningAnnounceHour: number;
  timezone?: string;
  bettingOpenMinutes?: number;
  bettingLockMinutesAfterStart?: number;
  trackedEventCount?: number;
}): EmbedBuilder {
  const tracked =
    settings.trackedEventCount === undefined
      ? null
      : settings.trackedEventCount === 0
        ? "None — tier-one feed only"
        : `${settings.trackedEventCount} extra event(s)`;

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
        name: "Morning announce",
        value: `${settings.morningAnnounceHour}:00 ${settings.timezone ?? "UTC"}`,
        inline: true,
      },
      ...(settings.bettingOpenMinutes !== undefined
        ? [{
            name: "Betting opens",
            value: `${settings.bettingOpenMinutes} min before start`,
            inline: true,
          }]
        : []),
      ...(settings.bettingLockMinutesAfterStart !== undefined
        ? [{
            name: "Betting locks",
            value: `${settings.bettingLockMinutesAfterStart} min after start`,
            inline: true,
          }]
        : []),
      ...(tracked
        ? [{ name: "Tracked events", value: tracked, inline: false }]
        : []),
    )
    .setDescription(
      "Majors, BLAST, ESL Pro League, and IEM are included after `/setup`. Use `/events track` to add other tournaments.",
    )
    .setTimestamp(new Date());
}
