import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import type { BotCommand } from "../client.js";
import {
  getOpenMarket,
  getOrCreateBalance,
  getUserBet,
} from "../../storage/betting-storage.js";
import { STARTING_BALANCE } from "../../types/betting.js";
import { credits } from "../../utils/embed-format.js";

export const balanceCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("balance")
    .setDescription("Check your wagering credits"),
  async execute(interaction) {
    if (!interaction.guildId) {
      await interaction.reply({ content: "This command can only be used in a server.", ephemeral: true });
      return;
    }

    const before = getOrCreateBalance(interaction.guildId, interaction.user.id);
    const created = before.balance === STARTING_BALANCE && before.betsWon === 0 && before.betsLost === 0;

    const openMarket = getOpenMarket(interaction.guildId);
    const activeBet =
      openMarket ? getUserBet(openMarket.id, interaction.user.id) : null;

    const embed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle("Your balance")
      .setDescription(
        [
          `Available · ${credits(before.balance)}`,
          created ? `\n*New account — you start with ${credits(STARTING_BALANCE)}.*` : null,
          activeBet
            ? `\nActive wager · ${credits(activeBet.amount)} on **${activeBet.side === 1 ? openMarket!.team1Name : openMarket!.team2Name}**`
            : null,
        ]
          .filter(Boolean)
          .join("\n"),
      )
      .addFields(
        {
          name: "Record",
          value: `${before.betsWon}W · ${before.betsLost}L · Won ${credits(before.totalWon)} · Lost ${credits(before.totalLost)}`,
          inline: false,
        },
      )
      .setFooter({ text: "Tap wager buttons on an open market to bet" });

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
