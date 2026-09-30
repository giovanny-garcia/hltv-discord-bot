import {
  ChannelType,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import type { BotCommand } from "../client.js";
import { getGgscoreCache, upsertGuildSettings } from "../../storage/db.js";
import {
  getGgscoreClient,
  getGgscoreScheduledSyncHours,
} from "../../services/ggscore-context.js";
import {
  getCachedUpcomingMatches,
  getUpcomingScheduleHorizon,
  syncGgscoreData,
} from "../../services/ggscore-cache.service.js";
import { GgscoreQuotaExceededError } from "../../services/ggscore.service.js";
import {
  checkManualHeavySync,
  explainManualHeavySyncBlock,
  recordManualHeavySync,
} from "../../services/ggscore-sync-guard.js";
import { isUpcoming, normalizeGgscoreMatch } from "../../utils/ggscore-match.util.js";
import { isTierOneEvent } from "../../utils/tier-one.js";

const CACHE_FRESH_MS = 12 * 60 * 60 * 1000;

function channelFromCommand(
  interaction: ChatInputCommandInteraction,
): { id: string } | null {
  const channel = interaction.channel;
  if (!channel || channel.isDMBased()) return null;
  if (
    channel.type === ChannelType.GuildText ||
    channel.type === ChannelType.GuildAnnouncement
  ) {
    return { id: channel.id };
  }
  return null;
}

export const setupCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("setup")
    .setDescription("Start match posts, watch parties, and betting in this channel")
    .addChannelOption((option) =>
      option
        .setName("announcements")
        .setDescription("Channel for the daily schedule (defaults to this channel)")
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement),
    )
    .addChannelOption((option) =>
      option
        .setName("betting")
        .setDescription("Channel for wagers (defaults to the announcement channel)")
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  async execute(interaction) {
    if (!interaction.guildId) {
      await interaction.reply({ content: "This command can only be used in a server.", ephemeral: true });
      return;
    }

    const announced = interaction.options.getChannel("announcements") ?? channelFromCommand(interaction);
    if (!announced) {
      await interaction.reply({
        content: "Run `/setup` in a text channel, or pass an announcements channel.",
        ephemeral: true,
      });
      return;
    }

    const betting = interaction.options.getChannel("betting") ?? announced;

    await interaction.deferReply();

    upsertGuildSettings(interaction.guildId, announced.id, {
      bettingChannelId: betting.id,
      announceMatches: true,
      feedMode: "tier1",
    });

    const syncNote = await refreshScheduleIfStale();
    const horizon = getUpcomingScheduleHorizon();
    const upcoming = getCachedUpcomingMatches()
      .map(normalizeGgscoreMatch)
      .filter((match) => isUpcoming(match) && match.scheduledAt);
    const tierOneNames = [
      ...new Set(
        upcoming.filter((match) => isTierOneEvent(match.eventName)).map((match) => match.eventName),
      ),
    ].filter((name): name is string => Boolean(name));

    const schedule =
      tierOneNames.length > 0
        ? `On the schedule now: ${tierOneNames.join(", ")}.`
        : "No tier-one matches are in the current schedule window. They will show up after a deeper refresh, or add any event with `/events track`.";

    await interaction.editReply(
      [
        `This server is ready. Schedule posts go in <#${announced.id}>. Wagers go in <#${betting.id}>.`,
        "",
        syncNote,
        horizon ? `Window: ${horizon}.` : null,
        schedule,
        "",
        "From here it runs on its own:",
        "• Majors, BLAST, ESL Pro League, and IEM are included. Add anything else with `/events track`.",
        "• Each match is added to the server Events list. Interested is the watch party.",
        "• A wager opens before the match. Pick a team on that message. `/leaderboard` is the scoreboard. Everyone starts with 1000 credits.",
        "",
        "Run `/help` anytime for the short guide.",
      ]
        .filter((line): line is string => line !== null)
        .join("\n"),
    );
  },
};

function callsLeft(remaining: number): string {
  return `${remaining} API call${remaining === 1 ? "" : "s"} left today.`;
}

async function refreshScheduleIfStale(): Promise<string> {
  const upcoming = getGgscoreCache("upcoming_matches");
  const results = getGgscoreCache("matches");
  const now = Date.now();
  const upcomingStale = !upcoming || now - upcoming.fetchedAt > CACHE_FRESH_MS;
  const resultsStale = !results || now - results.fetchedAt > CACHE_FRESH_MS;
  const hasUpcoming = getCachedUpcomingMatches().length > 0;
  const scheduled = getGgscoreScheduledSyncHours().length > 0;

  if (scheduled && hasUpcoming) {
    return "The schedule refreshes on its own, so this did not use an API call.";
  }

  if (!hasUpcoming && upcoming && !upcomingStale) {
    return "The schedule was already refreshed and has no upcoming matches, so this did not use an API call.";
  }

  if (hasUpcoming && !upcomingStale && !resultsStale) {
    return "The schedule was already fresh, so this did not use an API call.";
  }

  try {
    const client = getGgscoreClient();
    if (!hasUpcoming) return await refreshEmptySchedule(client);
    return await refreshStaleSchedule(client, upcomingStale, resultsStale);
  } catch (error) {
    if (error instanceof GgscoreQuotaExceededError) {
      return `Daily quota hit (${error.used}/${error.limit}). Cached matches still work until tomorrow.`;
    }
    const message = error instanceof Error ? error.message : String(error);
    return `Schedule refresh failed: ${message}`;
  }
}

/** One capped upcoming fetch. Counts as a manual heavy sync. */
async function refreshEmptySchedule(client: ReturnType<typeof getGgscoreClient>): Promise<string> {
  const gate = checkManualHeavySync();
  if (!gate.ok) {
    const followUp =
      getGgscoreScheduledSyncHours().length > 0
        ? " The next automatic sync will load the schedule."
        : "";
    return `${explainManualHeavySyncBlock(gate)}${followUp}`;
  }

  recordManualHeavySync();
  const result = await syncGgscoreData(client, "upcoming");
  const horizon = result.horizon ? ` ${result.horizon}.` : "";
  const problem = result.errors.length > 0 ? ` ${result.errors.join(" ")}` : "";
  return `Schedule loaded.${horizon}${problem} ${callsLeft(client.getQuota().remaining)}`;
}

/**
 * Used when scheduled hours are empty. Upcoming refresh is a manual heavy sync.
 * A results refresh may still spend the reserve.
 */
async function refreshStaleSchedule(
  client: ReturnType<typeof getGgscoreClient>,
  upcomingStale: boolean,
  resultsStale: boolean,
): Promise<string> {
  const notes: string[] = [];

  if (upcomingStale) {
    const gate = checkManualHeavySync();
    if (!gate.ok) {
      notes.push(explainManualHeavySyncBlock(gate));
    } else {
      recordManualHeavySync();
      const result = await syncGgscoreData(client, "upcoming");
      const horizon = result.horizon ? ` ${result.horizon}.` : "";
      notes.push(`Schedule refreshed.${horizon}`);
      if (result.errors.length > 0) notes.push(result.errors.join(" "));
    }
  }

  if (resultsStale && client.getQuota().remaining > 0) {
    await syncGgscoreData(client, "results");
    notes.push("Results refreshed.");
  }

  notes.push(callsLeft(client.getQuota().remaining));
  return notes.join(" ");
}
