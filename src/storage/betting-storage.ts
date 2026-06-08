import { getDb } from "./db.js";
import type {
  BetMarket,
  BetMarketStatus,
  BetSide,
  MarketPoolSummary,
  UserBalance,
  UserBet,
} from "../types/betting.js";
import { STARTING_BALANCE } from "../types/betting.js";

function rowToMarket(row: Record<string, unknown>): BetMarket {
  return {
    id: Number(row.id),
    guildId: String(row.guild_id),
    matchId: String(row.match_id),
    team1Name: String(row.team1_name),
    team2Name: String(row.team2_name),
    eventName: row.event_name ? String(row.event_name) : undefined,
    format: row.format ? String(row.format) : undefined,
    status: row.status as BetMarketStatus,
    channelId: String(row.channel_id),
    messageId: String(row.message_id),
    winnerSide: row.winner_side ? (Number(row.winner_side) as BetSide) : undefined,
    createdAt: Number(row.created_at),
    lockedAt: row.locked_at ? Number(row.locked_at) : undefined,
  };
}

function rowToBalance(row: Record<string, unknown>): UserBalance {
  return {
    guildId: String(row.guild_id),
    userId: String(row.user_id),
    balance: Number(row.balance),
    totalWon: Number(row.total_won),
    totalLost: Number(row.total_lost),
    betsWon: Number(row.bets_won),
    betsLost: Number(row.bets_lost),
  };
}

export function getOrCreateBalance(guildId: string, userId: string): UserBalance {
  const existing = getDb()
    .prepare("SELECT * FROM user_balances WHERE guild_id = ? AND user_id = ?")
    .get(guildId, userId) as Record<string, unknown> | undefined;

  if (existing) return rowToBalance(existing);

  const now = Date.now();
  getDb()
    .prepare(`
      INSERT INTO user_balances (guild_id, user_id, balance, created_at)
      VALUES (?, ?, ?, ?)
    `)
    .run(guildId, userId, STARTING_BALANCE, now);

  return {
    guildId,
    userId,
    balance: STARTING_BALANCE,
    totalWon: 0,
    totalLost: 0,
    betsWon: 0,
    betsLost: 0,
  };
}

export function setBalance(guildId: string, userId: string, balance: number): UserBalance {
  getOrCreateBalance(guildId, userId);
  getDb()
    .prepare("UPDATE user_balances SET balance = ? WHERE guild_id = ? AND user_id = ?")
    .run(balance, guildId, userId);
  return getOrCreateBalance(guildId, userId);
}

export function adjustBalance(
  guildId: string,
  userId: string,
  delta: number,
): UserBalance {
  const current = getOrCreateBalance(guildId, userId);
  return setBalance(guildId, userId, current.balance + delta);
}

export function getTopBalances(guildId: string, limit = 10): UserBalance[] {
  const rows = getDb()
    .prepare(
      "SELECT * FROM user_balances WHERE guild_id = ? ORDER BY balance DESC LIMIT ?",
    )
    .all(guildId, limit) as Record<string, unknown>[];
  return rows.map(rowToBalance);
}

export function countBalances(guildId: string): number {
  const row = getDb()
    .prepare("SELECT COUNT(*) as count FROM user_balances WHERE guild_id = ?")
    .get(guildId) as { count: number };
  return row.count;
}

export function createMarket(
  market: Omit<BetMarket, "id" | "createdAt" | "lockedAt" | "winnerSide" | "status"> & {
    status?: BetMarketStatus;
  },
): BetMarket {
  const result = getDb()
    .prepare(`
      INSERT INTO bet_markets (
        guild_id, match_id, team1_name, team2_name, event_name, format,
        status, channel_id, message_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      market.guildId,
      market.matchId,
      market.team1Name,
      market.team2Name,
      market.eventName ?? null,
      market.format ?? null,
      market.status ?? "open",
      market.channelId,
      market.messageId,
      Date.now(),
    );

  return getMarket(Number(result.lastInsertRowid))!;
}

export function getMarket(id: number): BetMarket | null {
  const row = getDb()
    .prepare("SELECT * FROM bet_markets WHERE id = ?")
    .get(id) as Record<string, unknown> | undefined;
  return row ? rowToMarket(row) : null;
}

export function getOpenMarket(guildId: string): BetMarket | null {
  const row = getDb()
    .prepare(
      "SELECT * FROM bet_markets WHERE guild_id = ? AND status = 'open' ORDER BY id DESC LIMIT 1",
    )
    .get(guildId) as Record<string, unknown> | undefined;
  return row ? rowToMarket(row) : null;
}

export function updateMarketMessage(id: number, messageId: string): void {
  getDb()
    .prepare("UPDATE bet_markets SET message_id = ? WHERE id = ?")
    .run(messageId, id);
}

export function lockMarket(id: number): BetMarket | null {
  getDb()
    .prepare("UPDATE bet_markets SET status = 'locked', locked_at = ? WHERE id = ? AND status = 'open'")
    .run(Date.now(), id);
  return getMarket(id);
}

export function settleMarket(id: number, winnerSide: BetSide): BetMarket | null {
  getDb()
    .prepare("UPDATE bet_markets SET status = 'settled', winner_side = ? WHERE id = ?")
    .run(winnerSide, id);
  return getMarket(id);
}

export function getUserBet(marketId: number, userId: string): UserBet | null {
  const row = getDb()
    .prepare("SELECT * FROM user_bets WHERE market_id = ? AND user_id = ?")
    .get(marketId, userId) as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    marketId: Number(row.market_id),
    guildId: String(row.guild_id),
    userId: String(row.user_id),
    side: Number(row.side) as BetSide,
    amount: Number(row.amount),
    payout: Number(row.payout),
    status: row.status as UserBet["status"],
    updatedAt: Number(row.updated_at),
  };
}

export function upsertUserBet(
  marketId: number,
  guildId: string,
  userId: string,
  side: BetSide,
  amount: number,
): UserBet {
  const now = Date.now();
  getDb()
    .prepare(`
      INSERT INTO user_bets (market_id, guild_id, user_id, side, amount, payout, status, updated_at)
      VALUES (?, ?, ?, ?, ?, 0, 'active', ?)
      ON CONFLICT(market_id, user_id) DO UPDATE SET
        side = excluded.side,
        amount = excluded.amount,
        status = 'active',
        payout = 0,
        updated_at = excluded.updated_at
    `)
    .run(marketId, guildId, userId, side, amount, now);

  return getUserBet(marketId, userId)!;
}

export function clearUserBet(marketId: number, userId: string): void {
  getDb()
    .prepare("DELETE FROM user_bets WHERE market_id = ? AND user_id = ?")
    .run(marketId, userId);
}

export function getMarketBets(marketId: number): UserBet[] {
  const rows = getDb()
    .prepare("SELECT * FROM user_bets WHERE market_id = ? AND status = 'active'")
    .all(marketId) as Record<string, unknown>[];

  return rows.map((row) => ({
    marketId: Number(row.market_id),
    guildId: String(row.guild_id),
    userId: String(row.user_id),
    side: Number(row.side) as BetSide,
    amount: Number(row.amount),
    payout: Number(row.payout),
    status: row.status as UserBet["status"],
    updatedAt: Number(row.updated_at),
  }));
}

export function getMarketPool(marketId: number): MarketPoolSummary {
  const rows = getDb()
    .prepare(`
      SELECT side, SUM(amount) as total, COUNT(*) as count
      FROM user_bets WHERE market_id = ? AND status = 'active'
      GROUP BY side
    `)
    .all(marketId) as { side: number; total: number; count: number }[];

  let team1Pool = 0;
  let team2Pool = 0;
  let betCount = 0;
  for (const row of rows) {
    if (row.side === 1) team1Pool = Number(row.total);
    if (row.side === 2) team2Pool = Number(row.total);
    betCount += Number(row.count);
  }

  return {
    team1Pool,
    team2Pool,
    totalPool: team1Pool + team2Pool,
    betCount,
  };
}

export function markBetResult(
  marketId: number,
  userId: string,
  status: "won" | "lost" | "refunded",
  payout: number,
): void {
  getDb()
    .prepare(`
      UPDATE user_bets SET status = ?, payout = ?, updated_at = ?
      WHERE market_id = ? AND user_id = ?
    `)
    .run(status, payout, Date.now(), marketId, userId);
}

export function recordBetWin(guildId: string, userId: string, profit: number): void {
  getOrCreateBalance(guildId, userId);
  getDb()
    .prepare(`
      UPDATE user_balances SET
        balance = balance + ?,
        total_won = total_won + ?,
        bets_won = bets_won + 1
      WHERE guild_id = ? AND user_id = ?
    `)
    .run(profit, profit, guildId, userId);
}

export function recordBetLoss(guildId: string, userId: string, loss: number): void {
  getOrCreateBalance(guildId, userId);
  getDb()
    .prepare(`
      UPDATE user_balances SET
        total_lost = total_lost + ?,
        bets_lost = bets_lost + 1
      WHERE guild_id = ? AND user_id = ?
    `)
    .run(loss, guildId, userId);
}
