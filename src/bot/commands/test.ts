import {
  ChannelType,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import type { BotCommand } from "../client.js";
import { handleTestSubcommand } from "../../test/test.service.js";

function previewOptions(
  sub: import("discord.js").SlashCommandSubcommandBuilder,
): import("discord.js").SlashCommandSubcommandBuilder {
  return sub
    .addStringOption((o) =>
      o.setName("json").setDescription("JSON merge over defaults (src/test/fixtures.ts)").setRequired(false),
    )
    .addBooleanOption((o) =>
      o.setName("public").setDescription("Post publicly to subscribed/ chosen channel").setRequired(false),
    )
    .addChannelOption((o) =>
      o
        .setName("channel")
        .setDescription("Channel for public post")
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement),
    );
}

function matchOptions(
  sub: import("discord.js").SlashCommandSubcommandBuilder,
): import("discord.js").SlashCommandSubcommandBuilder {
  return previewOptions(sub)
    .addStringOption((o) => o.setName("team1").setDescription("Team 1 name").setRequired(false))
    .addStringOption((o) => o.setName("team2").setDescription("Team 2 name").setRequired(false))
    .addStringOption((o) => o.setName("event").setDescription("Event name").setRequired(false))
    .addStringOption((o) => o.setName("format").setDescription("Format e.g. BO3").setRequired(false))
    .addIntegerOption((o) => o.setName("series1").setDescription("Team 1 series score").setRequired(false))
    .addIntegerOption((o) => o.setName("series2").setDescription("Team 2 series score").setRequired(false));
}

export const testCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("test")
    .setDescription("Preview betting & match UI with editable test data")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      matchOptions(
        sub
          .setName("upcoming")
          .setDescription("Preview upcoming match board")
          .addIntegerOption((o) =>
            o.setName("starts_in_minutes").setDescription("Minutes until start").setRequired(false),
          ),
      ),
    )
    .addSubcommand((sub) =>
      matchOptions(
        sub
          .setName("live")
          .setDescription("Preview live match board")
          .addIntegerOption((o) => o.setName("map").setDescription("Current map").setRequired(false))
          .addIntegerOption((o) => o.setName("mapscore1").setDescription("Team 1 map score").setRequired(false))
          .addIntegerOption((o) => o.setName("mapscore2").setDescription("Team 2 map score").setRequired(false))
          .addBooleanOption((o) =>
            o.setName("hide_spoilers").setDescription("Hide scores as spoilers").setRequired(false),
          ),
      ),
    )
    .addSubcommand((sub) =>
      matchOptions(
        sub
          .setName("finished")
          .setDescription("Preview final match board")
          .addStringOption((o) =>
            o
              .setName("winner")
              .setDescription("Series winner")
              .addChoices(
                { name: "Team 1", value: "team1" },
                { name: "Team 2", value: "team2" },
              ),
          ),
      ),
    )
    .addSubcommand((sub) =>
      previewOptions(
        sub
          .setName("wagers")
          .setDescription("Preview wager pool")
          .addStringOption((o) => o.setName("team1").setDescription("Team 1").setRequired(false))
          .addStringOption((o) => o.setName("team2").setDescription("Team 2").setRequired(false))
          .addStringOption((o) => o.setName("event").setDescription("Event").setRequired(false))
          .addIntegerOption((o) => o.setName("pool_total").setDescription("Total pool").setRequired(false))
          .addIntegerOption((o) => o.setName("team1_pool").setDescription("Team 1 pool").setRequired(false))
          .addIntegerOption((o) => o.setName("team2_pool").setDescription("Team 2 pool").setRequired(false))
          .addIntegerOption((o) => o.setName("bet_count").setDescription("Bet count").setRequired(false))
          .addIntegerOption((o) => o.setName("locks_in_minutes").setDescription("Lock timer").setRequired(false)),
      ),
    )
    .addSubcommand((sub) =>
      previewOptions(
        sub
          .setName("odds")
          .setDescription("Preview market odds")
          .addStringOption((o) => o.setName("team1").setDescription("Team 1").setRequired(false))
          .addStringOption((o) => o.setName("team2").setDescription("Team 2").setRequired(false))
          .addNumberOption((o) => o.setName("team1_odds").setDescription("Team 1 odds").setRequired(false))
          .addNumberOption((o) => o.setName("team2_odds").setDescription("Team 2 odds").setRequired(false))
          .addNumberOption((o) => o.setName("team1_pct").setDescription("Team 1 implied %").setRequired(false))
          .addNumberOption((o) => o.setName("team2_pct").setDescription("Team 2 implied %").setRequired(false)),
      ),
    )
    .addSubcommand((sub) =>
      previewOptions(
        sub
          .setName("payouts")
          .setDescription("Preview map payout")
          .addStringOption((o) => o.setName("event").setDescription("Event").setRequired(false))
          .addStringOption((o) => o.setName("market").setDescription("Market label").setRequired(false))
          .addStringOption((o) => o.setName("winner").setDescription("Winner team").setRequired(false))
          .addIntegerOption((o) => o.setName("total_paid").setDescription("Total paid").setRequired(false))
          .addStringOption((o) =>
            o
              .setName("entries")
              .setDescription("user:Alice|wagered:500|payout:820|profit:320, ...")
              .setRequired(false),
          ),
      ),
    )
    .addSubcommand((sub) =>
      previewOptions(
        sub
          .setName("rankings")
          .setDescription("Preview leaderboard")
          .addStringOption((o) => o.setName("title").setDescription("Title").setRequired(false))
          .addStringOption((o) =>
            o
              .setName("entries")
              .setDescription("rank:1|user:Alice|balance:12450|delta:820|winrate:68, ...")
              .setRequired(false),
          ),
      ),
    )
    .addSubcommand((sub) =>
      previewOptions(
        sub
          .setName("streaks")
          .setDescription("Preview streaks")
          .addStringOption((o) =>
            o
              .setName("entries")
              .setDescription("user:Alice|streak:5|type:win|best:8, ...")
              .setRequired(false),
          ),
      ),
    )
    .addSubcommand((sub) =>
      previewOptions(
        sub
          .setName("predictions")
          .setDescription("Preview event prediction leaders")
          .addStringOption((o) => o.setName("event").setDescription("Event").setRequired(false))
          .addStringOption((o) =>
            o
              .setName("entries")
              .setDescription("user:Alice|correct:14|total:18|profit:2340, ...")
              .setRequired(false),
          ),
      ),
    )
    .addSubcommand((sub) =>
      previewOptions(
        sub
          .setName("graph")
          .setDescription("Preview balance line graph")
          .addStringOption((o) => o.setName("title").setDescription("Chart title").setRequired(false))
          .addStringOption((o) => o.setName("metric").setDescription("Metric label").setRequired(false))
          .addStringOption((o) => o.setName("labels").setDescription("Mon,Tue,Wed").setRequired(false))
          .addStringOption((o) => o.setName("values").setDescription("1000,1200,980").setRequired(false)),
      ),
    )
    .addSubcommand((sub) =>
      previewOptions(
        sub
          .setName("all")
          .setDescription("Preview every test UI (bundled ephemeral, or paced public posts)")
          .addIntegerOption((o) =>
            o
              .setName("delay_ms")
              .setDescription("Delay between public posts (default 1500, min 1000)")
              .setMinValue(1000)
              .setMaxValue(5000),
          ),
      ),
    ),
  async execute(interaction) {
    try {
      await handleTestSubcommand(interaction);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Test preview failed.";
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: message, ephemeral: true });
      } else {
        await interaction.reply({ content: message, ephemeral: true });
      }
    }
  },
};
