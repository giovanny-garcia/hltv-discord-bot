export type DataProvider = "hltv" | "ggscore" | "both";

export interface GuildSettings {
  guildId: string;
  channelId: string;
  announceTournaments: boolean;
  announceMatches: boolean;
  minMatchStars: number;
  featuredOnly: boolean;
  matchReminderMinutes: number;
  tournamentReminderHours: number;
}

export type SeenItemKind = "event" | "match";

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
  dataProvider: DataProvider;
  ggscoreApiKey?: string;
  ggscoreBaseUrl: string;
  ggscoreDailyLimit: number;
  ggscoreSyncOnStart: boolean;
}
