import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { GuildSettings, SeenItem, SeenItemKind, TrackedEvent } from "../types/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, "../../data/bot.db");

let db: Database.Database;

function rowToSettings(row: Record<string, unknown>): GuildSettings {
  return {
    guildId: String(row.guild_id),
    channelId: String(row.channel_id),
    bettingChannelId: row.betting_channel_id ? String(row.betting_channel_id) : undefined,
    announceTournaments: Boolean(row.announce_tournaments),
    announceMatches: Boolean(row.announce_matches),
    minMatchStars: Number(row.min_match_stars),
    featuredOnly: Boolean(row.featured_only),
    matchReminderMinutes: Number(row.match_reminder_minutes),
    tournamentReminderHours: Number(row.tournament_reminder_hours),
  };
}

export function initDb(): void {
  mkdirSync(dirname(dbPath), { recursive: true });
  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS guild_settings (
      guild_id TEXT PRIMARY KEY,
      channel_id TEXT NOT NULL,
      announce_tournaments INTEGER NOT NULL DEFAULT 1,
      announce_matches INTEGER NOT NULL DEFAULT 1,
      min_match_stars INTEGER NOT NULL DEFAULT 0,
      featured_only INTEGER NOT NULL DEFAULT 0,
      match_reminder_minutes INTEGER NOT NULL DEFAULT 30,
      tournament_reminder_hours INTEGER NOT NULL DEFAULT 24
    );

    CREATE TABLE IF NOT EXISTS seen_items (
      guild_id TEXT NOT NULL,
      item_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      announced_at INTEGER NOT NULL,
      reminder_sent INTEGER NOT NULL DEFAULT 0,
      live_announced INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (guild_id, item_id)
    );

    CREATE TABLE IF NOT EXISTS ggscore_cache (
      cache_key TEXT PRIMARY KEY,
      payload TEXT NOT NULL,
      fetched_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ggscore_api_usage (
      usage_date TEXT PRIMARY KEY,
      request_count INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS user_balances (
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      balance INTEGER NOT NULL,
      total_won INTEGER NOT NULL DEFAULT 0,
      total_lost INTEGER NOT NULL DEFAULT 0,
      bets_won INTEGER NOT NULL DEFAULT 0,
      bets_lost INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (guild_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS bet_markets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      match_id TEXT NOT NULL,
      team1_name TEXT NOT NULL,
      team2_name TEXT NOT NULL,
      event_name TEXT,
      format TEXT,
      status TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      message_id TEXT NOT NULL,
      winner_side INTEGER,
      created_at INTEGER NOT NULL,
      locked_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS user_bets (
      market_id INTEGER NOT NULL,
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      side INTEGER NOT NULL,
      amount INTEGER NOT NULL,
      payout INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (market_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS guild_tracked_events (
      guild_id TEXT NOT NULL,
      event_id TEXT NOT NULL,
      event_name TEXT NOT NULL,
      added_at INTEGER NOT NULL,
      PRIMARY KEY (guild_id, event_id)
    );
  `);

  migrateGuildSettingsColumns();
}

function migrateGuildSettingsColumns(): void {
  const columns = db.prepare("PRAGMA table_info(guild_settings)").all() as { name: string }[];
  if (!columns.some((col) => col.name === "betting_channel_id")) {
    db.exec("ALTER TABLE guild_settings ADD COLUMN betting_channel_id TEXT");
  }
}

export function getDb(): Database.Database {
  return db;
}

export function closeDb(): void {
  db?.close();
}

export function upsertGuildSettings(
  guildId: string,
  channelId: string,
  partial?: Partial<Omit<GuildSettings, "guildId" | "channelId">> & {
    bettingChannelId?: string;
  },
): GuildSettings {
  const existing = getGuildSettings(guildId);

  const settings: GuildSettings = {
    guildId,
    channelId,
    bettingChannelId: partial?.bettingChannelId ?? existing?.bettingChannelId,
    announceTournaments: partial?.announceTournaments ?? existing?.announceTournaments ?? true,
    announceMatches: partial?.announceMatches ?? existing?.announceMatches ?? true,
    minMatchStars: partial?.minMatchStars ?? existing?.minMatchStars ?? 0,
    featuredOnly: partial?.featuredOnly ?? existing?.featuredOnly ?? false,
    matchReminderMinutes: partial?.matchReminderMinutes ?? existing?.matchReminderMinutes ?? 30,
    tournamentReminderHours:
      partial?.tournamentReminderHours ?? existing?.tournamentReminderHours ?? 24,
  };

  db.prepare(`
    INSERT INTO guild_settings (
      guild_id, channel_id, betting_channel_id, announce_tournaments, announce_matches,
      min_match_stars, featured_only, match_reminder_minutes, tournament_reminder_hours
    ) VALUES (
      @guildId, @channelId, @bettingChannelId, @announceTournaments, @announceMatches,
      @minMatchStars, @featuredOnly, @matchReminderMinutes, @tournamentReminderHours
    )
    ON CONFLICT(guild_id) DO UPDATE SET
      channel_id = excluded.channel_id,
      betting_channel_id = COALESCE(excluded.betting_channel_id, guild_settings.betting_channel_id),
      announce_tournaments = excluded.announce_tournaments,
      announce_matches = excluded.announce_matches,
      min_match_stars = excluded.min_match_stars,
      featured_only = excluded.featured_only,
      match_reminder_minutes = excluded.match_reminder_minutes,
      tournament_reminder_hours = excluded.tournament_reminder_hours
  `).run({
    guildId: settings.guildId,
    channelId: settings.channelId,
    bettingChannelId: settings.bettingChannelId ?? null,
    announceTournaments: settings.announceTournaments ? 1 : 0,
    announceMatches: settings.announceMatches ? 1 : 0,
    minMatchStars: settings.minMatchStars,
    featuredOnly: settings.featuredOnly ? 1 : 0,
    matchReminderMinutes: settings.matchReminderMinutes,
    tournamentReminderHours: settings.tournamentReminderHours,
  });

  return settings;
}

export function updateGuildSettings(
  guildId: string,
  partial: Partial<Omit<GuildSettings, "guildId">>,
): GuildSettings | null {
  const existing = getGuildSettings(guildId);
  if (!existing) return null;

  return upsertGuildSettings(guildId, partial.channelId ?? existing.channelId, {
    bettingChannelId: partial.bettingChannelId ?? existing.bettingChannelId,
    announceTournaments: partial.announceTournaments ?? existing.announceTournaments,
    announceMatches: partial.announceMatches ?? existing.announceMatches,
    minMatchStars: partial.minMatchStars ?? existing.minMatchStars,
    featuredOnly: partial.featuredOnly ?? existing.featuredOnly,
    matchReminderMinutes: partial.matchReminderMinutes ?? existing.matchReminderMinutes,
    tournamentReminderHours:
      partial.tournamentReminderHours ?? existing.tournamentReminderHours,
  });
}

export function getGuildSettings(guildId: string): GuildSettings | null {
  const row = db
    .prepare("SELECT * FROM guild_settings WHERE guild_id = ?")
    .get(guildId) as Record<string, unknown> | undefined;

  return row ? rowToSettings(row) : null;
}

export function removeGuildSettings(guildId: string): boolean {
  const result = db.prepare("DELETE FROM guild_settings WHERE guild_id = ?").run(guildId);
  db.prepare("DELETE FROM seen_items WHERE guild_id = ?").run(guildId);
  return result.changes > 0;
}

export function getAllGuildSettings(): GuildSettings[] {
  const rows = db.prepare("SELECT * FROM guild_settings").all() as Record<string, unknown>[];
  return rows.map(rowToSettings);
}

export function getSeenItem(guildId: string, itemId: string): SeenItem | null {
  const row = db
    .prepare("SELECT * FROM seen_items WHERE guild_id = ? AND item_id = ?")
    .get(guildId, itemId) as Record<string, unknown> | undefined;

  if (!row) return null;

  return {
    id: String(row.item_id),
    kind: row.kind as SeenItemKind,
    announcedAt: Number(row.announced_at),
    reminderSent: Boolean(row.reminder_sent),
    liveAnnounced: Boolean(row.live_announced),
  };
}

export function markSeen(guildId: string, itemId: string, kind: SeenItemKind): void {
  db.prepare(`
    INSERT INTO seen_items (guild_id, item_id, kind, announced_at, reminder_sent, live_announced)
    VALUES (@guildId, @itemId, @kind, @announcedAt, 0, 0)
    ON CONFLICT(guild_id, item_id) DO NOTHING
  `).run({ guildId, itemId, kind, announcedAt: Date.now() });
}

export function markReminderSent(guildId: string, itemId: string, kind: SeenItemKind): void {
  db.prepare(`
    INSERT INTO seen_items (guild_id, item_id, kind, announced_at, reminder_sent, live_announced)
    VALUES (@guildId, @itemId, @kind, @announcedAt, 1, 0)
    ON CONFLICT(guild_id, item_id) DO UPDATE SET reminder_sent = 1
  `).run({ guildId, itemId, kind, announcedAt: Date.now() });
}

export function markLiveAnnounced(guildId: string, itemId: string): void {
  db.prepare(`
    INSERT INTO seen_items (guild_id, item_id, kind, announced_at, reminder_sent, live_announced)
    VALUES (@guildId, @itemId, 'match', @announcedAt, 0, 1)
    ON CONFLICT(guild_id, item_id) DO UPDATE SET live_announced = 1
  `).run({ guildId, itemId, announcedAt: Date.now() });
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export function getGgscoreUsage(date = todayUtc()): number {
  const row = db
    .prepare("SELECT request_count FROM ggscore_api_usage WHERE usage_date = ?")
    .get(date) as { request_count: number } | undefined;
  return row?.request_count ?? 0;
}

export function incrementGgscoreUsage(count = 1, date = todayUtc()): number {
  db.prepare(`
    INSERT INTO ggscore_api_usage (usage_date, request_count)
    VALUES (@date, @count)
    ON CONFLICT(usage_date) DO UPDATE SET request_count = request_count + @count
  `).run({ date, count });

  return getGgscoreUsage(date);
}

export function setGgscoreCache(cacheKey: string, payload: unknown): void {
  db.prepare(`
    INSERT INTO ggscore_cache (cache_key, payload, fetched_at)
    VALUES (@cacheKey, @payload, @fetchedAt)
    ON CONFLICT(cache_key) DO UPDATE SET
      payload = excluded.payload,
      fetched_at = excluded.fetched_at
  `).run({
    cacheKey,
    payload: JSON.stringify(payload),
    fetchedAt: Date.now(),
  });
}

export function getGgscoreCache<T>(cacheKey: string): { payload: T; fetchedAt: number } | null {
  const row = db
    .prepare("SELECT payload, fetched_at FROM ggscore_cache WHERE cache_key = ?")
    .get(cacheKey) as { payload: string; fetched_at: number } | undefined;

  if (!row) return null;

  return {
    payload: JSON.parse(row.payload) as T,
    fetchedAt: row.fetched_at,
  };
}

export function getGgscoreCacheMeta(): { key: string; fetchedAt: number }[] {
  const rows = db
    .prepare("SELECT cache_key, fetched_at FROM ggscore_cache ORDER BY fetched_at DESC")
    .all() as { cache_key: string; fetched_at: number }[];

  return rows.map((row) => ({ key: row.cache_key, fetchedAt: row.fetched_at }));
}

export function getTrackedEvents(guildId: string): TrackedEvent[] {
  const rows = db
    .prepare(
      "SELECT * FROM guild_tracked_events WHERE guild_id = ? ORDER BY event_name COLLATE NOCASE",
    )
    .all(guildId) as Record<string, unknown>[];

  return rows.map((row) => ({
    guildId: String(row.guild_id),
    eventId: String(row.event_id),
    eventName: String(row.event_name),
    addedAt: Number(row.added_at),
  }));
}

export function addTrackedEvent(
  guildId: string,
  eventId: string,
  eventName: string,
): TrackedEvent {
  const addedAt = Date.now();
  db.prepare(`
    INSERT INTO guild_tracked_events (guild_id, event_id, event_name, added_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(guild_id, event_id) DO UPDATE SET event_name = excluded.event_name
  `).run(guildId, eventId, eventName, addedAt);

  return { guildId, eventId, eventName, addedAt };
}

export function removeTrackedEvent(guildId: string, eventId: string): boolean {
  const result = db
    .prepare("DELETE FROM guild_tracked_events WHERE guild_id = ? AND event_id = ?")
    .run(guildId, eventId);
  return result.changes > 0;
}

export function clearTrackedEvents(guildId: string): number {
  const result = db
    .prepare("DELETE FROM guild_tracked_events WHERE guild_id = ?")
    .run(guildId);
  return result.changes;
}
