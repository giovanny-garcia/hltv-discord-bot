export interface GuildSettings {
  guildId: string;
  channelId: string;
  bettingChannelId?: string;
  announceTournaments: boolean;
  announceMatches: boolean;
  minMatchStars: number;
  featuredOnly: boolean;
  matchReminderMinutes: number;
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
}
