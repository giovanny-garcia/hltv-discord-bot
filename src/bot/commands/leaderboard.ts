import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import type { BotCommand } from "../client.js";
import { countBalances, getTopBalances } from "../../storage/betting-storage.js";
import { credits, medalForRank } from "../../utils/embed-format.js";

export const leaderboardCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("leaderboard")
    .setDescription("Top balances in this server"),
  async execute(interaction) {
    if (!interaction.guildId) {
      await interaction.reply({ content: "This command can only be used in a server.", ephemeral: true });
      return;
    }

    const top = getTopBalances(interaction.guildId, 10);
    const total = countBalances(interaction.guildId);

    if (top.length === 0) {
      await interaction.reply({
        content: "No one has wagered yet. Open a market with `/betting open` — credits appear on first bet or `/balance`.",
        ephemeral: true,
      });
      return;
    }

    const lines = top.map((entry, index) => {
      const rank = medalForRank(index + 1);
      const record = `${entry.betsWon}W/${entry.betsLost}L`;
      return `${rank} <@${entry.userId}> · ${credits(entry.balance)} · ${record}`;
    });

    const embed = new EmbedBuilder()
      .setColor(0xf1c40f)
      .setTitle("Leaderboard")
      .setDescription(lines.join("\n"))
      .setFooter({ text: `${total} player${total === 1 ? "" : "s"} with balances` });

    await interaction.reply({ embeds: [embed] });
  },
};
