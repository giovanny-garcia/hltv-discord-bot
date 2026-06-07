import { EmbedBuilder } from "discord.js";
import type { HltvEvent, HltvMatch } from "../services/hltv.service.js";
import {
  eventUrl,
  formatDateRange,
  formatTimestamp,
  matchLabel,
  matchUrl,
  starsDisplay,
} from "../services/hltv.service.js";

const TOURNAMENT_COLOR = 0x2ecc71;
const MATCH_COLOR = 0x3498db;
const REMINDER_COLOR = 0xf39c12;
const LIVE_COLOR = 0xe74c3c;

export function newTournamentEmbed(event: HltvEvent): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(TOURNAMENT_COLOR)
    .setTitle(`New Tournament: ${event.name}`)
    .setURL(eventUrl(event))
    .setDescription("A new CS tournament has been added to HLTV.")
    .addFields(
      { name: "Dates", value: formatDateRange(event.dateStart, event.dateEnd), inline: false },
    )
    .setTimestamp(new Date());

  if (event.location?.name) {
    embed.addFields({ name: "Location", value: event.location.name, inline: true });
  }
  if (event.prizePool) {
    embed.addFields({ name: "Prize Pool", value: event.prizePool, inline: true });
  }
  if (event.numberOfTeams) {
    embed.addFields({ name: "Teams", value: String(event.numberOfTeams), inline: true });
  }
  if (event.featured) {
    embed.setFooter({ text: "Featured event" });
  }

  return embed;
}

export function tournamentReminderEmbed(event: HltvEvent): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(REMINDER_COLOR)
    .setTitle(`Starting Soon: ${event.name}`)
    .setURL(eventUrl(event))
    .setDescription("This tournament is starting within the reminder window.")
    .addFields({
      name: "Starts",
      value: formatTimestamp(event.dateStart),
      inline: false,
    })
    .setTimestamp(new Date());
}

export function newMatchEmbed(match: HltvMatch): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(MATCH_COLOR)
    .setTitle(`New Match: ${matchLabel(match)}`)
    .setURL(matchUrl(match))
    .setDescription("A new match has been scheduled on HLTV.")
    .addFields(
      { name: "Scheduled", value: formatTimestamp(match.date), inline: true },
      { name: "Format", value: match.format || "TBA", inline: true },
      { name: "Rating", value: starsDisplay(match.stars), inline: true },
    )
    .setTimestamp(new Date());

  if (match.event?.name) {
    embed.addFields({ name: "Event", value: match.event.name, inline: false });
  }

  return embed;
}

export function matchReminderEmbed(match: HltvMatch): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(REMINDER_COLOR)
    .setTitle(`Match Starting Soon: ${matchLabel(match)}`)
    .setURL(matchUrl(match))
    .setDescription("This match is starting within the reminder window.")
    .addFields(
      { name: "Starts", value: formatTimestamp(match.date), inline: true },
      { name: "Format", value: match.format || "TBA", inline: true },
    )
    .setTimestamp(new Date());
}

export function matchLiveEmbed(match: HltvMatch): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(LIVE_COLOR)
    .setTitle(`LIVE: ${matchLabel(match)}`)
    .setURL(matchUrl(match))
    .setDescription("This match is now live on HLTV.")
    .addFields(
      { name: "Format", value: match.format || "TBA", inline: true },
      { name: "Rating", value: starsDisplay(match.stars), inline: true },
    )
    .setTimestamp(new Date());
}

export function eventsListEmbed(events: HltvEvent[]): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(TOURNAMENT_COLOR)
    .setTitle("Upcoming Tournaments")
    .setTimestamp(new Date());

  if (events.length === 0) {
    embed.setDescription("No upcoming tournaments found.");
    return embed;
  }

  const lines = events.slice(0, 15).map((event) => {
    const featured = event.featured ? " ⭐" : "";
    return `• [**${event.name}**](${eventUrl(event)})${featured} — ${formatDateRange(event.dateStart, event.dateEnd)}`;
  });

  embed.setDescription(lines.join("\n"));
  if (events.length > 15) {
    embed.setFooter({ text: `Showing 15 of ${events.length} events` });
  }

  return embed;
}

export function matchesListEmbed(matches: HltvMatch[], minStars = 0): EmbedBuilder {
  const filtered = matches.filter((m) => m.stars >= minStars);

  const embed = new EmbedBuilder()
    .setColor(MATCH_COLOR)
    .setTitle("Upcoming Matches")
    .setTimestamp(new Date());

  if (filtered.length === 0) {
    embed.setDescription("No upcoming matches found for the current filter.");
    return embed;
  }

  const lines = filtered.slice(0, 15).map((match) => {
    const live = match.live ? " 🔴 LIVE" : "";
    return `• [**${matchLabel(match)}**](${matchUrl(match)})${live} — ${formatTimestamp(match.date)} (${starsDisplay(match.stars)})`;
  });

  embed.setDescription(lines.join("\n"));
  if (filtered.length > 15) {
    embed.setFooter({ text: `Showing 15 of ${filtered.length} matches` });
  }

  return embed;
}

export function settingsEmbed(settings: {
  channelId: string;
  announceTournaments: boolean;
  announceMatches: boolean;
  minMatchStars: number;
  featuredOnly: boolean;
  matchReminderMinutes: number;
  tournamentReminderHours: number;
}): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0x95a5a6)
    .setTitle("Announcement Settings")
    .addFields(
      { name: "Channel", value: `<#${settings.channelId}>`, inline: true },
      {
        name: "Tournaments",
        value: settings.announceTournaments ? "Enabled" : "Disabled",
        inline: true,
      },
      {
        name: "Matches",
        value: settings.announceMatches ? "Enabled" : "Disabled",
        inline: true,
      },
      { name: "Min match stars", value: String(settings.minMatchStars), inline: true },
      { name: "Featured only", value: settings.featuredOnly ? "Yes" : "No", inline: true },
      {
        name: "Match reminder",
        value: `${settings.matchReminderMinutes} min before start`,
        inline: true,
      },
      {
        name: "Tournament reminder",
        value: `${settings.tournamentReminderHours}h before start`,
        inline: true,
      },
    )
    .setTimestamp(new Date());
}
