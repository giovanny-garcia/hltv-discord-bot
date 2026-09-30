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
  /** Min ms between admin /sync for heavy scopes (upcoming|full). 0 disables. */
  ggscoreSyncCooldownMs: number;
  /** Upcoming pages per heavy sync. Each page is one API call. */
  ggscoreMaxUpcomingPages: number;
  /** Heavy syncs refuse to start when remaining calls are at or below this. */
  ggscoreReserveCalls: number;
  /** Manual upcoming/full syncs per UTC day. Scheduled syncs do not count. */
  ggscoreManualHeavySyncsPerDay: number;
  /** UTC hours (0–23) for automatic full sync. Empty = disabled. */
  ggscoreScheduledSyncHours: number[];
  lifecycleIntervalMs: number;
  /** Guild where /demo and /test are registered. Empty = those commands stay hidden. */
  devGuildId?: string;
  /** Discord user IDs allowed to run dev commands. Empty = anyone in the dev guild. */
  devUserIds: string[];
}
