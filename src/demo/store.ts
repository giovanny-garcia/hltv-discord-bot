import type { BetSide } from "../types/betting.js";
import {
  DEMO_MIN_BET,
  DEMO_STARTING_BALANCE,
  type DemoBet,
  type DemoPoolSummary,
  type DemoSession,
} from "./types.js";

const sessions = new Map<string, DemoSession>();
const balances = new Map<string, number>();
const bets = new Map<string, DemoBet>();

function balanceKey(guildId: string, userId: string): string {
  return `${guildId}:${userId}`;
}

function betKey(guildId: string, userId: string): string {
  return `${guildId}:${userId}`;
}

export function getDemoSession(guildId: string): DemoSession | undefined {
  const session = sessions.get(guildId);
  return session ? structuredClone(session) : undefined;
}

/** Internal — returns live session reference for simulation updates. */
export function getDemoSessionForUpdate(guildId: string): DemoSession | undefined {
  return sessions.get(guildId);
}

export function setDemoSession(session: DemoSession): void {
  sessions.set(session.guildId, structuredClone(session));
}

export function clearDemoSession(guildId: string): void {
  sessions.delete(guildId);
}

export function getDemoBalance(guildId: string, userId: string): number {
  return balances.get(balanceKey(guildId, userId)) ?? 0;
}

export function getOrCreateDemoBalance(guildId: string, userId: string): number {
  const key = balanceKey(guildId, userId);
  if (!balances.has(key)) {
    balances.set(key, DEMO_STARTING_BALANCE);
  }
  return balances.get(key)!;
}

export function adjustDemoBalance(guildId: string, userId: string, delta: number): number {
  const key = balanceKey(guildId, userId);
  const current = getOrCreateDemoBalance(guildId, userId);
  const next = Math.max(0, current + delta);
  balances.set(key, next);
  return next;
}

export function getDemoBet(guildId: string, userId: string): DemoBet | undefined {
  const bet = bets.get(betKey(guildId, userId));
  return bet ? { ...bet } : undefined;
}

export function upsertDemoBet(
  guildId: string,
  userId: string,
  side: BetSide,
  amount: number,
  meta?: { displayName?: string; simulated?: boolean },
): DemoBet {
  const bet: DemoBet = {
    userId,
    side,
    amount,
    displayName: meta?.displayName,
    simulated: meta?.simulated,
  };
  bets.set(betKey(guildId, userId), bet);
  return bet;
}

export function clearDemoBet(guildId: string, userId: string): void {
  bets.delete(betKey(guildId, userId));
}

export function getDemoBets(guildId: string): DemoBet[] {
  const prefix = `${guildId}:`;
  const result: DemoBet[] = [];
  for (const [key, bet] of bets) {
    if (key.startsWith(prefix)) {
      result.push({ ...bet });
    }
  }
  return result;
}

export function getDemoPool(guildId: string): DemoPoolSummary {
  const active = getDemoBets(guildId);
  let team1Pool = 0;
  let team2Pool = 0;
  for (const bet of active) {
    if (bet.side === 1) team1Pool += bet.amount;
    else team2Pool += bet.amount;
  }
  return {
    team1Pool,
    team2Pool,
    totalPool: team1Pool + team2Pool,
    betCount: active.length,
  };
}

export function resetDemoEconomy(guildId: string): void {
  const prefix = `${guildId}:`;
  for (const key of [...balances.keys()]) {
    if (key.startsWith(prefix)) balances.delete(key);
  }
  for (const key of [...bets.keys()]) {
    if (key.startsWith(prefix)) bets.delete(key);
  }
}

export function validateDemoWagerAmount(amount: number): void {
  if (!Number.isInteger(amount) || amount < DEMO_MIN_BET) {
    throw new Error(`Minimum demo wager is **${DEMO_MIN_BET}** credits.`);
  }
}
