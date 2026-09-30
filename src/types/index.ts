export type AnnounceFeed = "tier1" | "all" | "tracked";

export interface GuildSettings {
  guildId: string;
  channelId: string;
  bettingChannelId?: string;
  announceTournaments: boolean;
  announceMatches: boolean;
  feedMode: AnnounceFeed;
  minMatchStars: number;
  featuredOnly: boolean;
  matchReminderMinutes: number;
  morningAnnounceHour: number;
  timezone: string;
  tournamentReminderHours: number;
  bettingOpenMinutes: number;
  bettingLockMinutesAfterStart: number;
}

export type SeenItemKind = "event" | "match";

export interface TrackedEvent {
  guildId: string;
  eventId: string;
  eventName: string;
  addedAt: number;
}

export interface SeenItem {
  id: string;
  kind: SeenItemKind;
  announcedAt: number;
  reminderSent: boolean;
  liveAnnounced: boolean;
}

export interface EnvConfig {
  discordToken: string;
  discordClientId: string;
  discordGuildId?: string;
  pollIntervalMs: number;
  ggscoreApiKey: string;
  ggscoreBaseUrl: string;
  ggscoreDailyLimit: number;
  ggscoreSyncOnStart: boolean;
  lifecycleIntervalMs: number;
  /** Guild where /demo and /test are registered. Empty = those commands stay hidden. */
  devGuildId?: string;
  /** Discord user IDs allowed to run dev commands. Empty = anyone in the dev guild. */
  devUserIds: string[];
}
