import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import type { BotCommand } from "../client.js";
import { getGuildSettings, updateGuildSettings } from "../../storage/db.js";
import { formatInTimeZone, isValidTimeZone, listTimeZones } from "../../utils/time-zone.js";

export const timezoneCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("timezone")
    .setDescription("Show or set this server's timezone")
    .addStringOption((option) =>
      option
        .setName("zone")
        .setDescription("IANA timezone, such as America/Chicago")
        .setAutocomplete(true),
    ),
  async autocomplete(interaction) {
    const focused = interaction.options.getFocused();
    const choices = listTimeZones(focused).map((zone) => ({ name: zone, value: zone }));
    await interaction.respond(choices);
  },
  async execute(interaction) {
    if (!interaction.guildId) {
      await interaction.reply({ content: "This command can only be used in a server.", ephemeral: true });
      return;
    }

    const settings = getGuildSettings(interaction.guildId);
    if (!settings) {
      await interaction.reply({
        content: "Run `/setup` first.",
        ephemeral: true,
      });
      return;
    }

    const zone = interaction.options.getString("zone");
    if (!zone) {
      const now = Math.floor(Date.now() / 1000);
      await interaction.reply({
        content: `This server uses **${settings.timezone}**. It is ${formatInTimeZone(now, settings.timezone)}. The daily schedule posts at **${settings.morningAnnounceHour}:00** in that timezone.`,
        ephemeral: true,
      });
      return;
    }

    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      await interaction.reply({
        content: "You need Manage Server to change the timezone.",
        ephemeral: true,
      });
      return;
    }

    if (!isValidTimeZone(zone)) {
      await interaction.reply({
        content: `**${zone}** is not a timezone. Try \`America/Chicago\` or pick one from the list.`,
        ephemeral: true,
      });
      return;
    }

    const updated = updateGuildSettings(interaction.guildId, { timezone: zone });
    if (!updated) {
      await interaction.reply({ content: "Failed to update the timezone.", ephemeral: true });
      return;
    }

    const now = Math.floor(Date.now() / 1000);
    await interaction.reply(
      `Timezone set to **${updated.timezone}**. It is ${formatInTimeZone(now, updated.timezone)}. The daily schedule still posts at **${updated.morningAnnounceHour}:00** in that timezone. Change the hour with \`/settings\`.`,
    );
  },
};
