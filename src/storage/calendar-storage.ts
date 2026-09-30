import { getDb } from "./db.js";

export interface CalendarEventRow {
  guildId: string;
  matchId: string;
  discordEventId: string;
  scheduledAt: number;
  name: string;
}

function rowToCalendarEvent(row: Record<string, unknown>): CalendarEventRow {
  return {
    guildId: String(row.guild_id),
    matchId: String(row.match_id),
    discordEventId: String(row.discord_event_id),
    scheduledAt: Number(row.scheduled_at),
    name: String(row.name),
  };
}

export function listCalendarEvents(guildId: string): CalendarEventRow[] {
  const rows = getDb()
    .prepare("SELECT * FROM guild_calendar_events WHERE guild_id = ?")
    .all(guildId) as Record<string, unknown>[];
  return rows.map(rowToCalendarEvent);
}

export function saveCalendarEvent(row: CalendarEventRow): void {
  getDb()
    .prepare(
      `INSERT INTO guild_calendar_events (guild_id, match_id, discord_event_id, scheduled_at, name)
       VALUES (@guildId, @matchId, @discordEventId, @scheduledAt, @name)
       ON CONFLICT(guild_id, match_id) DO UPDATE SET
         discord_event_id = excluded.discord_event_id,
         scheduled_at = excluded.scheduled_at,
         name = excluded.name`,
    )
    .run(row);
}

export function deleteCalendarEvent(guildId: string, matchId: string): void {
  getDb()
    .prepare("DELETE FROM guild_calendar_events WHERE guild_id = ? AND match_id = ?")
    .run(guildId, matchId);
}
