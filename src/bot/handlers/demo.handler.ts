import {
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ButtonInteraction,
  type ModalSubmitInteraction,
} from "discord.js";
import {
  cancelDemoWager,
  placeDemoWager,
  refreshDemoBettingMessage,
} from "../../demo/betting.js";
import { getOrCreateDemoBalance } from "../../demo/store.js";
import { DEMO_MIN_BET } from "../../demo/types.js";
import { credits } from "../../utils/embed-format.js";

export function isDemoButton(customId: string): boolean {
  return customId.startsWith("demo:");
}

export function isDemoModal(customId: string): boolean {
  return customId.startsWith("demo:modal:");
}

export async function handleDemoButton(interaction: ButtonInteraction): Promise<boolean> {
  if (!isDemoButton(interaction.customId)) return false;

  if (!interaction.guildId) {
    await interaction.reply({ content: "Demo wagers only work in a server.", ephemeral: true });
    return true;
  }

  const parts = interaction.customId.split(":");

  if (parts[1] === "pick") {
    const side = Number(parts[2]);
    if (side !== 1 && side !== 2) {
      await interaction.reply({ content: "Invalid demo wager button.", ephemeral: true });
      return true;
    }

    const balance = getOrCreateDemoBalance(interaction.guildId, interaction.user.id);
    const modal = new ModalBuilder()
      .setCustomId(`demo:modal:${side}`)
      .setTitle("Place demo wager")
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId("amount")
            .setLabel(`Demo amount (min ${DEMO_MIN_BET}, balance ${balance})`)
            .setStyle(TextInputStyle.Short)
            .setPlaceholder(String(Math.min(100, balance)))
            .setRequired(true)
            .setMinLength(1)
            .setMaxLength(8),
        ),
      );

    await interaction.showModal(modal);
    return true;
  }

  if (parts[1] === "quick") {
    const side = Number(parts[2]) as 1 | 2;
    const amount = Number(parts[3]);

    await interaction.deferReply({ ephemeral: true });
    try {
      const result = placeDemoWager(
        interaction.guildId,
        interaction.user.id,
        side,
        amount,
      );
      await refreshDemoBettingMessage(interaction.client, interaction.guildId);
      await interaction.editReply(
        `Demo wager: ${credits(amount)} on **${result.teamName}**. Demo balance: ${credits(result.balance)}.`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not place demo wager.";
      await interaction.editReply(message);
    }
    return true;
  }

  if (parts[1] === "cancel") {
    await interaction.deferReply({ ephemeral: true });
    try {
      const balance = cancelDemoWager(interaction.guildId, interaction.user.id);
      await refreshDemoBettingMessage(interaction.client, interaction.guildId);
      await interaction.editReply(`Demo wager cleared. Demo balance: ${credits(balance)}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not clear demo wager.";
      await interaction.editReply(message);
    }
    return true;
  }

  return false;
}

export async function handleDemoModal(interaction: ModalSubmitInteraction): Promise<boolean> {
  if (!isDemoModal(interaction.customId)) return false;

  if (!interaction.guildId) {
    await interaction.reply({ content: "Demo wagers only work in a server.", ephemeral: true });
    return true;
  }

  const side = Number(interaction.customId.split(":")[2]) as 1 | 2;
  const amount = Number(interaction.fields.getTextInputValue("amount"));

  await interaction.deferReply({ ephemeral: true });
  try {
    const result = placeDemoWager(interaction.guildId, interaction.user.id, side, amount);
    await refreshDemoBettingMessage(interaction.client, interaction.guildId);
    await interaction.editReply(
      `Demo wager: ${credits(amount)} on **${result.teamName}**. Demo balance: ${credits(result.balance)}.`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not place demo wager.";
    await interaction.editReply(message);
  }

  return true;
}
