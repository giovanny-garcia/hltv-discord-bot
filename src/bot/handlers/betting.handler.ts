import {
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ButtonInteraction,
  type ModalSubmitInteraction,
} from "discord.js";
import {
  cancelWager,
  MIN_BET,
  placeWager,
  refreshMarketMessageWithClient,
} from "../../services/betting.service.js";
import { getOrCreateBalance } from "../../storage/betting-storage.js";
import { credits } from "../../utils/embed-format.js";

export function isBettingButton(customId: string): boolean {
  return customId.startsWith("bet:") && !customId.startsWith("bet:modal:");
}

export function isBettingModal(customId: string): boolean {
  return customId.startsWith("bet:modal:");
}

export async function handleBettingButton(interaction: ButtonInteraction): Promise<boolean> {
  if (!isBettingButton(interaction.customId)) return false;

  if (!interaction.guildId) {
    await interaction.reply({ content: "Wagers only work in a server.", ephemeral: true });
    return true;
  }

  const parts = interaction.customId.split(":");
  const action = parts[1];

  if (action === "pick") {
    const marketId = Number(parts[2]);
    const side = Number(parts[3]);
    if (!marketId || (side !== 1 && side !== 2)) {
      await interaction.reply({ content: "Invalid wager button.", ephemeral: true });
      return true;
    }

    const balance = getOrCreateBalance(interaction.guildId, interaction.user.id);
    const modal = new ModalBuilder()
      .setCustomId(`bet:modal:${marketId}:${side}`)
      .setTitle("Place wager")
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId("amount")
            .setLabel(`Amount (min ${MIN_BET}, balance ${balance.balance})`)
            .setStyle(TextInputStyle.Short)
            .setPlaceholder(String(Math.min(100, balance.balance)))
            .setRequired(true)
            .setMinLength(1)
            .setMaxLength(8),
        ),
      );

    await interaction.showModal(modal);
    return true;
  }

  if (action === "quick") {
    const marketId = Number(parts[2]);
    const side = Number(parts[3]) as 1 | 2;
    const amount = Number(parts[4]);

    await interaction.deferReply({ ephemeral: true });
    try {
      const result = placeWager(marketId, interaction.guildId, interaction.user.id, side, amount);
      await refreshMarketMessageWithClient(marketId, interaction.client);
      await interaction.editReply(
        `Wagered ${credits(amount)} on **${result.teamName}**. Balance: ${credits(result.balance)}.`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not place wager.";
      await interaction.editReply(message);
    }
    return true;
  }

  if (action === "cancel") {
    const marketId = Number(parts[2]);
    await interaction.deferReply({ ephemeral: true });
    try {
      const balance = cancelWager(marketId, interaction.guildId, interaction.user.id);
      await refreshMarketMessageWithClient(marketId, interaction.client);
      await interaction.editReply(`Wager cleared. Balance: ${credits(balance)}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not clear wager.";
      await interaction.editReply(message);
    }
    return true;
  }

  return false;
}

export async function handleBettingModal(interaction: ModalSubmitInteraction): Promise<boolean> {
  if (!isBettingModal(interaction.customId)) return false;

  if (!interaction.guildId) {
    await interaction.reply({ content: "Wagers only work in a server.", ephemeral: true });
    return true;
  }

  const parts = interaction.customId.split(":");
  const marketId = Number(parts[2]);
  const side = Number(parts[3]) as 1 | 2;
  const rawAmount = interaction.fields.getTextInputValue("amount").replace(/,/g, "");
  const amount = Number.parseInt(rawAmount, 10);

  await interaction.deferReply({ ephemeral: true });

  if (!Number.isInteger(amount)) {
    await interaction.editReply(`Enter a whole number (minimum ${MIN_BET}).`);
    return true;
  }

  try {
    const result = placeWager(marketId, interaction.guildId, interaction.user.id, side, amount);
    await refreshMarketMessageWithClient(marketId, interaction.client);
    await interaction.editReply(
      `Wagered ${credits(amount)} on **${result.teamName}**. Balance: ${credits(result.balance)}.`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not place wager.";
    await interaction.editReply(message);
  }

  return true;
}
