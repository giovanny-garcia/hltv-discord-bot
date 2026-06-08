import {
  ChannelType,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import type { BotCommand } from "../client.js";
import {
  getCachedUpcomingMatches,
} from "../../services/ggscore-cache.service.js";
import {
  lockMarketForGuild,
  openMarketForGuild,
  resolveBettingChannelId,
  settleMarketForGuild,
} from "../../services/betting.service.js";
import {
  getMarketPool,
  getOpenMarket,
} from "../../storage/betting-storage.js";
import { getGuildSettings } from "../../storage/db.js";
import type { BetSide } from "../../types/betting.js";
import { openMarketEmbed } from "../../utils/betting.embed.js";
import { normalizeGgscoreMatch } from "../../utils/ggscore-match.util.js";
import { credits } from "../../utils/embed-format.js";

export const bettingCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("betting")
    .setDescription("Manage wagering markets (admin)")
    .addSubcommand((sub) =>
      sub
        .setName("open")
        .setDescription("Open wagers on the next cached upcoming match")
        .addIntegerOption((option) =>
          option
            .setName("match")
            .setDescription("Upcoming match index from /matches (default 0)")
            .setMinValue(0)
            .setMaxValue(20),
        )
        .addChannelOption((option) =>
          option
            .setName("channel")
            .setDescription("Override betting channel")
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement),
        ),
    )
    .addSubcommand((sub) =>
      sub.setName("lock").setDescription("Lock the open market — no more wagers"),
    )
    .addSubcommand((sub) =>
      sub
        .setName("settle")
        .setDescription("Settle the locked market and pay winners")
        .addStringOption((option) =>
          option
            .setName("winner")
            .setDescription("Winning team")
            .setRequired(true)
            .addChoices(
              { name: "Team 1", value: "team1" },
              { name: "Team 2", value: "team2" },
            ),
        ),
    )
    .addSubcommand((sub) =>
      sub.setName("status").setDescription("Show the current market status"),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  async execute(interaction) {
    if (!interaction.guildId) {
      await interaction.reply({ content: "This command can only be used in a server.", ephemeral: true });
      return;
    }

    const sub = interaction.options.getSubcommand();

    if (sub === "status") {
      const market = getOpenMarket(interaction.guildId);
      if (!market) {
        await interaction.reply({
          content: "No open market. Run `/betting open` after syncing matches.",
          ephemeral: true,
        });
        return;
      }

      const pool = getMarketPool(market.id);
      await interaction.reply({
        embeds: [openMarketEmbed(market, pool)],
        ephemeral: true,
      });
      return;
    }

    if (sub === "open") {
      await interaction.deferReply({ ephemeral: true });

      const channelOption = interaction.options.getChannel("channel");
      const settings = getGuildSettings(interaction.guildId);
      const channelId =
        channelOption?.id ?? resolveBettingChannelId(interaction.guildId);

      if (!channelId) {
        await interaction.editReply(
          "No betting channel set. Run `/setup` with a betting channel first.",
        );
        return;
      }

      const channel = await interaction.guild!.channels.fetch(channelId);
      if (!channel?.isTextBased() || channel.isDMBased()) {
        await interaction.editReply("Betting channel must be a text channel.");
        return;
      }

      const matchIndex = interaction.options.getInteger("match") ?? 0;
      const upcoming = getCachedUpcomingMatches().map(normalizeGgscoreMatch);

      try {
        const result = await openMarketForGuild(
          interaction.guildId,
          channel,
          matchIndex,
        );
        const match = upcoming[matchIndex];
        await interaction.editReply(
          [
            `Market **#${result.marketId}** opened in ${channel}.`,
            match ? `${match.team1Name} vs ${match.team2Name}` : "",
            `[Jump to wager message](${result.messageUrl})`,
            "",
            "Everyone gets **1,000 credits** on first `/balance` or first wager.",
          ]
            .filter(Boolean)
            .join("\n"),
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to open market.";
        await interaction.editReply(message);
      }
      return;
    }

    if (sub === "lock") {
      await interaction.deferReply({ ephemeral: true });
      try {
        const market = await lockMarketForGuild(interaction.guildId, interaction.client);
        const pool = getMarketPool(market.id);
        await interaction.editReply(
          `Locked **${market.team1Name} vs ${market.team2Name}** · Pool ${credits(pool.totalPool)} · ${pool.betCount} wager(s).`,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to lock market.";
        await interaction.editReply(message);
      }
      return;
    }

    if (sub === "settle") {
      await interaction.deferReply({ ephemeral: true });
      const winner = interaction.options.getString("winner", true);
      const winnerSide: BetSide = winner === "team1" ? 1 : 2;

      try {
        const result = await settleMarketForGuild(
          interaction.guildId,
          winnerSide,
          interaction.client,
        );
        await interaction.editReply(
          `Market **#${result.marketId}** settled · ${result.winnersPaid} winner(s) paid ${credits(result.totalPaid)} total.`,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to settle market.";
        await interaction.editReply(message);
      }
    }
  },
};
