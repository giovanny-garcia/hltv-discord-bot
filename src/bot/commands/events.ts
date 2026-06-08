import {
  AutocompleteInteraction,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import type { BotCommand } from "../client.js";
import {
  addTrackedEvent,
  clearTrackedEvents,
  getGuildSettings,
  getTrackedEvents,
  removeTrackedEvent,
} from "../../storage/db.js";
import {
  cachedEventsEmbed,
  trackedEventsEmbed,
} from "../../utils/ggscore-embeds.js";
import {
  findCachedEvent,
  getCachedEventOptions,
} from "../../utils/event-cache.util.js";

function trackedIdSet(guildId: string): Set<string> {
  return new Set(getTrackedEvents(guildId).map((event) => event.eventId));
}

function respondEventAutocomplete(interaction: AutocompleteInteraction): void {
  const focused = interaction.options.getFocused(true);
  const query = focused.value.toLowerCase();
  const choices = getCachedEventOptions()
    .filter((event) => event.name.toLowerCase().includes(query))
    .slice(0, 25)
    .map((event) => ({
      name: `${event.name}${event.upcomingCount > 0 ? ` (${event.upcomingCount} upcoming)` : ""}`.slice(
        0,
        100,
      ),
      value: event.id.slice(0, 100),
    }));

  void interaction.respond(choices);
}

export const eventsCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("events")
    .setDescription("Browse cached events and choose which ones to announce")
    .addSubcommand((sub) =>
      sub.setName("list").setDescription("All events in cache (📌 = announcing)"),
    )
    .addSubcommand((sub) =>
      sub
        .setName("track")
        .setDescription("Start announcing matches from an event")
        .addStringOption((option) =>
          option
            .setName("event")
            .setDescription("Event to track")
            .setRequired(true)
            .setAutocomplete(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("untrack")
        .setDescription("Stop announcing matches from an event")
        .addStringOption((option) =>
          option
            .setName("event")
            .setDescription("Event to remove")
            .setRequired(true)
            .setAutocomplete(true),
        ),
    )
    .addSubcommand((sub) =>
      sub.setName("tracked").setDescription("Events you are currently announcing"),
    )
    .addSubcommand((sub) =>
      sub
        .setName("clear")
        .setDescription("Remove all tracked events (pauses announcements)"),
    ),
  async autocomplete(interaction) {
    if (interaction.commandName !== "events") return;
    respondEventAutocomplete(interaction);
  },
  async execute(interaction) {
    if (!interaction.guildId) {
      await interaction.reply({ content: "This command can only be used in a server.", ephemeral: true });
      return;
    }

    const sub = interaction.options.getSubcommand();

    if (sub === "list") {
      const events = getCachedEventOptions();
      const tracked = trackedIdSet(interaction.guildId);
      await interaction.reply({
        embeds: [cachedEventsEmbed(events, tracked)],
        ephemeral: true,
      });
      return;
    }

    if (sub === "tracked") {
      const tracked = getTrackedEvents(interaction.guildId);
      const cached = getCachedEventOptions();
      const enriched = tracked.map((entry) => ({
        eventName: entry.eventName,
        upcomingCount: cached.find((event) => event.id === entry.eventId)?.upcomingCount ?? 0,
      }));
      await interaction.reply({
        embeds: [trackedEventsEmbed(enriched)],
        ephemeral: true,
      });
      return;
    }

    if (sub === "clear") {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
        await interaction.reply({ content: "You need Manage Server to clear tracked events.", ephemeral: true });
        return;
      }

      const removed = clearTrackedEvents(interaction.guildId);
      await interaction.reply({
        content:
          removed > 0
            ? `Removed **${removed}** tracked event(s). Announcements are paused until you track events again.`
            : "No tracked events to clear.",
        ephemeral: true,
      });
      return;
    }

    if (sub === "track" || sub === "untrack") {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
        await interaction.reply({
          content: "You need Manage Server to change tracked events.",
          ephemeral: true,
        });
        return;
      }

      const settings = getGuildSettings(interaction.guildId);
      if (!settings) {
        await interaction.reply({
          content: "Run `/setup` or `/subscribe` first to configure an announcement channel.",
          ephemeral: true,
        });
        return;
      }

      const eventId = interaction.options.getString("event", true);
      const cached = findCachedEvent(eventId);

      if (!cached) {
        await interaction.reply({
          content: "That event is not in cache. Run `/sync scope:full` and try again.",
          ephemeral: true,
        });
        return;
      }

      if (sub === "track") {
        addTrackedEvent(interaction.guildId, cached.id, cached.name);
        await interaction.reply({
          content: `Now announcing **${cached.name}**${cached.upcomingCount > 0 ? ` (${cached.upcomingCount} upcoming match${cached.upcomingCount === 1 ? "" : "es"})` : ""}.`,
        });
        return;
      }

      const removed = removeTrackedEvent(interaction.guildId, cached.id);
      await interaction.reply({
        content: removed
          ? `Stopped announcing **${cached.name}**.`
          : `**${cached.name}** was not tracked.`,
        ephemeral: true,
      });
    }
  },
};
