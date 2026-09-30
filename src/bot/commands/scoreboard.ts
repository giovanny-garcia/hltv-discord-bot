import {
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import type { BotCommand } from "../client.js";
import {
  repostAllScoreboards,
  repostScoreboard,
} from "../../services/scoreboard.service.js";
import { getLifecycleSessionsForGuild } from "../../storage/lifecycle-storage.js";

export const scoreboardCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("scoreboard")
    .setDescription("Manage match scorecards (admin)")
    .addSubcommand((sub) =>
      sub
        .setName("repost")
        .setDescription("Delete the old scorecard (if it exists) and post a fresh one")
        .addStringOption((option) =>
          option
            .setName("match")
            .setDescription("Match ID from lifecycle (see /scoreboard list)")
            .setRequired(true)
            .setAutocomplete(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("repost-all")
        .setDescription("Repost scorecards for every tracked match session"),
    )
    .addSubcommand((sub) =>
      sub.setName("list").setDescription("List lifecycle sessions with scorecard refs"),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  async autocomplete(interaction) {
    if (!interaction.guildId) return;

    const focused = interaction.options.getFocused().toLowerCase();
    const sessions = getLifecycleSessionsForGuild(interaction.guildId)
      .filter(
        (session) =>
          session.bettingOpenSent ||
          session.matchStartSent ||
          session.matchFinishSent ||
          session.boardMessageId,
      )
      .slice(0, 25);

    const choices = sessions
      .filter((session) => {
        const label = `${session.team1Name} vs ${session.team2Name} (${session.matchId})`;
        return (
          session.matchId.includes(focused) ||
          session.team1Name.toLowerCase().includes(focused) ||
          session.team2Name.toLowerCase().includes(focused) ||
          label.toLowerCase().includes(focused)
        );
      })
      .map((session) => ({
        name: `${session.team1Name} vs ${session.team2Name} · ${session.status}`.slice(0, 100),
        value: session.matchId,
      }));

    await interaction.respond(choices.slice(0, 25));
  },
  async execute(interaction) {
    if (!interaction.guildId) {
      await interaction.reply({
        content: "This command can only be used in a server.",
        ephemeral: true,
      });
      return;
    }

    const sub = interaction.options.getSubcommand();

    if (sub === "list") {
      const sessions = getLifecycleSessionsForGuild(interaction.guildId);
      if (sessions.length === 0) {
        await interaction.reply({
          content: "No lifecycle sessions yet. Track events and sync matches first.",
          ephemeral: true,
        });
        return;
      }

      const lines = sessions.slice(0, 20).map((session) => {
        const board = session.boardMessageId ? "has scorecard" : "no scorecard";
        return `• \`${session.matchId}\` — **${session.team1Name} vs ${session.team2Name}** (${session.status}, ${board})`;
      });

      await interaction.reply({
        content: [
          `**Lifecycle sessions** (${sessions.length} total):`,
          ...lines,
          sessions.length > 20 ? `_…and ${sessions.length - 20} more_` : null,
        ]
          .filter(Boolean)
          .join("\n"),
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    if (sub === "repost") {
      const matchId = interaction.options.getString("match", true);
      try {
        const result = await repostScoreboard(interaction.client, interaction.guildId, matchId);
        if (!result) {
          await interaction.editReply("Scorecard repost failed — no message was created.");
          return;
        }
        await interaction.editReply(`Scorecard reposted: ${result.messageUrl}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Repost failed.";
        await interaction.editReply(message);
      }
      return;
    }

    if (sub === "repost-all") {
      const result = await repostAllScoreboards(interaction.client, interaction.guildId);
      const lines = [
        `Reposted **${result.reposted}** scorecard${result.reposted === 1 ? "" : "s"}.`,
      ];
      if (result.failed.length > 0) {
        lines.push("", "**Failed:**", ...result.failed.map((entry) => `• ${entry}`));
      }
      await interaction.editReply(lines.join("\n"));
    }
  },
};
