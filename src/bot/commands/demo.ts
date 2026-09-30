import {
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import type { BotCommand } from "../client.js";
import {
  clearDemo,
  concludeDemo,
  formatDemoStatus,
  getDemoBalance,
  getDemoPool,
  getOrCreateDemoBalance,
  startDemo,
  stopDemo,
} from "../../demo/service.js";
import { adjustDemoBalance, getDemoBet } from "../../demo/store.js";
import { DEMO_STARTING_BALANCE } from "../../demo/types.js";
import { credits } from "../../utils/embed-format.js";

export const demoCommand: BotCommand = {
  devOnly: true,
  data: new SlashCommandBuilder()
    .setName("demo")
    .setDescription("Run a simulated match with demo betting (separate from real balance)")
    .addSubcommand((sub) =>
      sub
        .setName("start")
        .setDescription("Start a demo match — scorecard + demo betting, scores tick every second")
        .addStringOption((option) =>
          option.setName("team1").setDescription("Team 1 name (default Vitality)"),
        )
        .addStringOption((option) =>
          option.setName("team2").setDescription("Team 2 name (default NAVI)"),
        )
        .addIntegerOption((option) =>
          option
            .setName("interval")
            .setDescription("Seconds between score updates (default 1)")
            .setMinValue(1)
            .setMaxValue(30),
        ),
    )
    .addSubcommand((sub) =>
      sub.setName("stop").setDescription("Stop the running demo simulation (admin)"),
    )
    .addSubcommand((sub) =>
      sub
        .setName("conclude")
        .setDescription("Skip to the end — finish the series and settle demo wagers now")
        .addStringOption((option) =>
          option
            .setName("winner")
            .setDescription("Who wins (default: current series lead, or random)")
            .addChoices(
              { name: "Team 1", value: "team1" },
              { name: "Team 2", value: "team2" },
            ),
        ),
    )
    .addSubcommand((sub) =>
      sub.setName("status").setDescription("Show demo match phase, scores, and pool"),
    )
    .addSubcommand((sub) =>
      sub
        .setName("balance")
        .setDescription("Check your demo credits (not your real /balance)")
        .addUserOption((option) =>
          option.setName("user").setDescription("Another member (defaults to you)"),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("reset-balance")
        .setDescription("Reset your demo credits to the starting amount"),
    ),
  async execute(interaction) {
    if (!interaction.guildId) {
      await interaction.reply({
        content: "This command can only be used in a server.",
        ephemeral: true,
      });
      return;
    }

    const sub = interaction.options.getSubcommand();

    if (sub === "balance") {
      const target = interaction.options.getUser("user") ?? interaction.user;
      getOrCreateDemoBalance(interaction.guildId, target.id);
      const balance = getDemoBalance(interaction.guildId, target.id);
      const bet = getDemoBet(interaction.guildId, target.id);
      const lines = [
        `🧪 **Demo balance** for ${target.displayName}: ${credits(balance)}`,
        `_Real balance is unchanged — use \`/balance\` for production credits._`,
      ];
      if (bet) {
        lines.push(`Active demo wager: ${credits(bet.amount)} on team ${bet.side}.`);
      }
      await interaction.reply({ content: lines.join("\n"), ephemeral: true });
      return;
    }

    if (sub === "reset-balance") {
      const current = getOrCreateDemoBalance(interaction.guildId, interaction.user.id);
      adjustDemoBalance(interaction.guildId, interaction.user.id, DEMO_STARTING_BALANCE - current);
      await interaction.reply({
        content: `Demo balance reset to ${credits(DEMO_STARTING_BALANCE)}. Real balance untouched.`,
        ephemeral: true,
      });
      return;
    }

    if (sub === "status") {
      const pool = getDemoPool(interaction.guildId);
      await interaction.reply({
        content: [
          formatDemoStatus(interaction.guildId),
          "",
          `Pool: ${credits(pool.totalPool)} (${pool.betCount} wagers)`,
        ].join("\n"),
        ephemeral: true,
      });
      return;
    }

    if (sub === "stop") {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
        await interaction.reply({
          content: "You need **Manage Server** to stop a demo.",
          ephemeral: true,
        });
        return;
      }
      stopDemo(interaction.guildId);
      clearDemo(interaction.guildId);
      await interaction.reply({
        content: "Demo stopped. Demo session and in-memory demo credits cleared for this server.",
        ephemeral: true,
      });
      return;
    }

    if (sub === "conclude") {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
        await interaction.reply({
          content: "You need **Manage Server** to conclude a demo.",
          ephemeral: true,
        });
        return;
      }

      await interaction.deferReply({ ephemeral: true });
      const winnerOpt = interaction.options.getString("winner");
      const winner = winnerOpt === "team1" ? 1 : winnerOpt === "team2" ? 2 : undefined;

      try {
        const result = await concludeDemo(interaction.client, interaction.guildId, winner);
        await interaction.editReply(
          [
            `✅ Demo concluded — **${result.winnerName}** wins (${result.series}).`,
            `Settled **${result.winnersPaid}** winner${result.winnersPaid === 1 ? "" : "s"} for **${result.totalPaid}** demo credits.`,
            "Scorecard and betting message updated. Use `/demo stop` to clear, or `/demo start` again.",
          ].join("\n"),
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : "Could not conclude demo.";
        await interaction.editReply(message);
      }
      return;
    }

    if (sub === "start") {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
        await interaction.reply({
          content: "You need **Manage Server** to start a demo.",
          ephemeral: true,
        });
        return;
      }

      await interaction.deferReply({ ephemeral: true });
      const team1 = interaction.options.getString("team1") ?? undefined;
      const team2 = interaction.options.getString("team2") ?? undefined;
      const intervalSec = interaction.options.getInteger("interval") ?? 1;

      try {
        const result = await startDemo(interaction.client, interaction.guildId, {
          team1Name: team1,
          team2Name: team2,
          tickIntervalMs: intervalSec * 1000,
        });

        await interaction.editReply(
          [
            `🧪 **Demo started** (\`${result.matchId}\`)`,
            `Teams: **${team1 ?? "Vitality"}** vs **${team2 ?? "NAVI"}**`,
            `Score updates every **${intervalSec}s**.`,
            "",
            "1. Wager with demo buttons in the betting channel",
            "2. Betting locks when the demo match goes live (~6s)",
            "3. Maps play out — or jump ahead with `/demo conclude`",
            "",
            `_Use \`/demo balance\` for demo credits. \`/balance\` is your real balance._`,
          ].join("\n"),
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : "Could not start demo.";
        await interaction.editReply(message);
      }
    }
  },
};
