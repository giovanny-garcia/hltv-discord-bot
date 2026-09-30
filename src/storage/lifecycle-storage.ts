import { getDb } from "./db.js";
import type { LifecycleStatus, MatchLifecycleSession } from "../types/lifecycle.js";
import type { NormalizedGgscoreMatch } from "../utils/ggscore-match.util.js";

function rowToSession(row: Record<string, unknown>): MatchLifecycleSession {
  return {
    id: Number(row.id),
    guildId: String(row.guild_id),
    matchId: String(row.match_id),
    team1Name: String(row.team1_name),
    team2Name: String(row.team2_name),
    eventName: row.event_name ? String(row.event_name) : undefined,
    format: row.format ? String(row.format) : undefined,
    scheduledAt: Number(row.scheduled_at),
    status: row.status as LifecycleStatus,
    marketId: row.market_id ? Number(row.market_id) : undefined,
    boardChannelId: row.board_channel_id ? String(row.board_channel_id) : undefined,
    boardMessageId: row.board_message_id ? String(row.board_message_id) : undefined,
    mapsAnnounced: Number(row.maps_announced),
    team1Series: Number(row.team1_series),
    team2Series: Number(row.team2_series),
    winnerSide: row.winner_side ? (Number(row.winner_side) as 1 | 2) : undefined,
    hideSpoilers: Boolean(row.hide_spoilers),
    bettingOpenSent: Boolean(row.betting_open_sent),
    matchStartSent: Boolean(row.match_start_sent),
    bettingLockSent: Boolean(row.betting_lock_sent),
    matchFinishSent: Boolean(row.match_finish_sent),
    boardJson: row.board_json ? String(row.board_json) : undefined,
    createdAt: Number(row.created_at),
  };
}

export function getLifecycleSession(
  guildId: string,
  matchId: string,
): MatchLifecycleSession | null {
  const row = getDb()
    .prepare("SELECT * FROM match_lifecycle WHERE guild_id = ? AND match_id = ?")
    .get(guildId, matchId) as Record<string, unknown> | undefined;
  return row ? rowToSession(row) : null;
}

export function getActiveLifecycleSessions(guildId: string): MatchLifecycleSession[] {
  const rows = getDb()
    .prepare(
      "SELECT * FROM match_lifecycle WHERE guild_id = ? AND status IN ('betting_open', 'live') ORDER BY scheduled_at ASC",
    )
    .all(guildId) as Record<string, unknown>[];
  return rows.map(rowToSession);
}

export function ensureLifecycleSession(
  guildId: string,
  match: NormalizedGgscoreMatch,
): MatchLifecycleSession {
  const existing = getLifecycleSession(guildId, match.id);
  if (existing) return existing;

  const now = Date.now();
  const result = getDb()
    .prepare(`
      INSERT INTO match_lifecycle (
        guild_id, match_id, team1_name, team2_name, event_name, format,
        scheduled_at, status, maps_announced, team1_series, team2_series,
        hide_spoilers, betting_open_sent, match_start_sent, betting_lock_sent,
        match_finish_sent, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'scheduled', 0, 0, 0, 1, 0, 0, 0, 0, ?)
    `)
    .run(
      guildId,
      match.id,
      match.team1Name,
      match.team2Name,
      match.eventName ?? null,
      match.kind ?? null,
      match.scheduledAt ?? now,
      now,
    );

  return getLifecycleSession(guildId, match.id) ?? rowToSession({
    id: result.lastInsertRowid,
    guild_id: guildId,
    match_id: match.id,
    team1_name: match.team1Name,
    team2_name: match.team2Name,
    event_name: match.eventName ?? null,
    format: match.kind ?? null,
    scheduled_at: match.scheduledAt ?? now,
    status: "scheduled",
    maps_announced: 0,
    team1_series: 0,
    team2_series: 0,
    hide_spoilers: 1,
    betting_open_sent: 0,
    match_start_sent: 0,
    betting_lock_sent: 0,
    match_finish_sent: 0,
    created_at: now,
  });
}

export function updateLifecycleSession(
  id: number,
  partial: Partial<
    Pick<
      MatchLifecycleSession,
      | "status"
      | "marketId"
      | "boardChannelId"
      | "boardMessageId"
      | "mapsAnnounced"
      | "team1Series"
      | "team2Series"
      | "winnerSide"
      | "hideSpoilers"
      | "bettingOpenSent"
      | "matchStartSent"
      | "bettingLockSent"
      | "matchFinishSent"
      | "boardJson"
    >
  >,
): MatchLifecycleSession | null {
  const current = getDb()
    .prepare("SELECT * FROM match_lifecycle WHERE id = ?")
    .get(id) as Record<string, unknown> | undefined;
  if (!current) return null;

  const session = rowToSession(current);
  const next = { ...session, ...partial };

  getDb()
    .prepare(`
      UPDATE match_lifecycle SET
        status = ?,
        market_id = ?,
        board_channel_id = ?,
        board_message_id = ?,
        maps_announced = ?,
        team1_series = ?,
        team2_series = ?,
        winner_side = ?,
        hide_spoilers = ?,
        betting_open_sent = ?,
        match_start_sent = ?,
        betting_lock_sent = ?,
        match_finish_sent = ?,
        board_json = ?
      WHERE id = ?
    `)
    .run(
      next.status,
      next.marketId ?? null,
      next.boardChannelId ?? null,
      next.boardMessageId ?? null,
      next.mapsAnnounced,
      next.team1Series,
      next.team2Series,
      next.winnerSide ?? null,
      next.hideSpoilers ? 1 : 0,
      next.bettingOpenSent ? 1 : 0,
      next.matchStartSent ? 1 : 0,
      next.bettingLockSent ? 1 : 0,
      next.matchFinishSent ? 1 : 0,
      next.boardJson ?? null,
      id,
    );

  return getLifecycleSession(session.guildId, session.matchId);
}

export function getLifecycleBoardJson(guildId: string, matchId: string): string | null {
  const session = getLifecycleSession(guildId, matchId);
  return session?.boardJson ?? null;
}

export function setLifecycleBoardJson(
  guildId: string,
  matchId: string,
  boardJson: string,
  hideSpoilers: boolean,
): void {
  const session = getLifecycleSession(guildId, matchId);
  if (!session) return;
  updateLifecycleSession(session.id, { boardJson, hideSpoilers });
}
