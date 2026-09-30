import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import type { BotCommand } from "../client.js";
import { getUpcomingScheduleHorizon } from "../../services/ggscore-cache.service.js";

function cmd(command: string, blurb: string): string {
  return `**${command}**\n${blurb}`;
}

export const helpCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("How to use this bot for schedules, watch parties, and wagers"),
  async execute(interaction) {
    const horizon = getUpcomingScheduleHorizon();

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle("CS2 bot help")
      .setDescription(
        [
          "Run **`/setup`** once (Manage Server). After that the bot posts matches, creates server Events, and opens friendly wagers.",
          "",
          horizon
            ? `Schedule cache · ${horizon}`
            : "Schedule cache · empty — run `/setup` or `/sync scope:upcoming`",
        ].join("\n"),
      )
      .addFields(
        {
          name: "Start",
          value: [
            cmd("/setup", "Channel, schedule refresh, tier-one feed, watch parties, wagers"),
            cmd("/timezone", "Server clock for the morning post (e.g. `America/Chicago`)"),
            cmd("/events reset", "Back to tier-one only"),
          ].join("\n\n"),
        },
        {
          name: "Tier-one feed",
          value:
            "Majors · BLAST · ESL Pro League · IEM · EWC\n`/events defaults` for the full rules (ESL Challenger ≠ Pro League)",
        },
        {
          name: "Browse & follow",
          value: [
            cmd("/events list", "⭐ default · 📌 you added · 🚫 hidden"),
            cmd("/events track · untrack", "Add or hide a tournament"),
            cmd("/next", "Next match on this server’s watch list"),
            cmd("/matches · /results", "Full cache lists"),
          ].join("\n\n"),
        },
        {
          name: "Watch parties & wagers",
          value: [
            "1. Each followed match becomes a server **Event** — mark Interested",
            "2. A wager opens before kickoff — pick a team on that message",
            "3. `/balance` and `/leaderboard` — everyone starts with **1000** credits",
          ].join("\n"),
        },
        {
          name: "API quota",
          value: [
            "`/quota` — calls left today",
            "Upcoming and full syncs are capped (pages, a reserve, and a daily manual limit)",
            "`/sync scope:results` can still refresh",
          ].join("\n"),
        },
      )
      .setFooter({
        text: "Manage Server needed for /setup, /events changes, /sync, and /timezone",
      })
      .setTimestamp(new Date());

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
