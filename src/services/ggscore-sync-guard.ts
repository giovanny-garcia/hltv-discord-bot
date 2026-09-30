import type { GgscoreSyncScope } from "../types/ggscore.js";
import {
  clearScheduledSyncSlot,
  getLastHeavySyncAt,
  getManualHeavySyncCount,
  hasScheduledSyncSlot,
  incrementManualHeavySyncCount,
  markScheduledSyncSlot,
  pruneScheduledSyncSlots,
  setLastHeavySyncAt,
} from "../storage/db.js";
import { getGgscoreClient, getGgscoreQuotaPolicy } from "./ggscore-context.js";
import { syncGgscoreData } from "./ggscore-cache.service.js";

const HEAVY_SCOPES = new Set<GgscoreSyncScope>(["upcoming", "full"]);

export function isHeavySyncScope(scope: GgscoreSyncScope): boolean {
  return HEAVY_SCOPES.has(scope);
}

export type ManualHeavySyncGate =
  | { ok: true }
  | { ok: false; reason: "cooldown"; retryAfterMs: number }
  | { ok: false; reason: "daily_cap"; used: number; limit: number }
  | {
      ok: false;
      reason: "reserve";
      remaining: number;
      reserve: number;
      used: number;
      limit: number;
    };

export function checkHeavySyncCooldown(
  cooldownMs: number,
): { ok: true } | { ok: false; retryAfterMs: number } {
  const lastHeavySyncAt = getLastHeavySyncAt();
  if (!Number.isFinite(cooldownMs) || cooldownMs <= 0 || lastHeavySyncAt <= 0) return { ok: true };
  const elapsed = Date.now() - lastHeavySyncAt;
  if (elapsed >= cooldownMs) return { ok: true };
  return { ok: false, retryAfterMs: cooldownMs - elapsed };
}

/** Scheduled and startup syncs update the cooldown without using a manual slot. */
export function recordHeavySyncTime(): void {
  setLastHeavySyncAt(Date.now());
}

/** Manual upcoming/full syncs, including an empty-cache /setup, use one daily slot. */
export function recordManualHeavySync(): void {
  recordHeavySyncTime();
  incrementManualHeavySyncCount();
}

export function checkManualHeavySync(): ManualHeavySyncGate {
  const policy = getGgscoreQuotaPolicy();
  const usedToday = getManualHeavySyncCount();
  if (usedToday >= policy.manualHeavySyncsPerDay) {
    return {
      ok: false,
      reason: "daily_cap",
      used: usedToday,
      limit: policy.manualHeavySyncsPerDay,
    };
  }

  const cooldown = checkHeavySyncCooldown(policy.syncCooldownMs);
  if (!cooldown.ok) return { ok: false, reason: "cooldown", retryAfterMs: cooldown.retryAfterMs };

  const quota = getGgscoreClient().getQuota();
  if (quota.remaining <= policy.reserveCalls) {
    return {
      ok: false,
      reason: "reserve",
      remaining: quota.remaining,
      reserve: policy.reserveCalls,
      used: quota.used,
      limit: quota.limit,
    };
  }

  return { ok: true };
}

export function explainManualHeavySyncBlock(
  gate: Exclude<ManualHeavySyncGate, { ok: true }>,
): string {
  if (gate.reason === "cooldown") {
    return `Schedule sync is on cooldown (${formatCooldown(gate.retryAfterMs)} left). Use \`/sync scope:results\` to refresh results, or wait.`;
  }
  if (gate.reason === "daily_cap") {
    return `Manual schedule syncs are capped at ${gate.limit} per day (${gate.used} already used). \`/sync scope:results\` can still refresh.`;
  }
  if (gate.remaining <= 0) {
    return `Daily quota is used up (${gate.used}/${gate.limit}). Cached matches still work until tomorrow.`;
  }
  const calls = `${gate.remaining} API call${gate.remaining === 1 ? "" : "s"}`;
  return `${calls} left today, reserved so results can still refresh. Use \`/sync scope:results\`.`;
}

export function formatCooldown(ms: number): string {
  const totalSec = Math.ceil(ms / 1000);
  if (totalSec < 60) return `${totalSec}s`;
  const minutes = Math.ceil(totalSec / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return rem === 0 ? `${hours}h` : `${hours}h ${rem}m`;
}

/**
 * Runs a full sync once per configured UTC hour if that slot has not run yet today.
 * The slot is stored in SQLite so a restart does not run it again.
 * Call from a short interval (e.g. every minute).
 */
export async function tickScheduledSync(hoursUtc: number[]): Promise<void> {
  if (hoursUtc.length === 0) return;

  const now = new Date();
  const hour = now.getUTCHours();
  if (!hoursUtc.includes(hour)) return;

  const dateUtc = now.toISOString().slice(0, 10);
  if (hasScheduledSyncSlot(dateUtc, hour)) return;

  markScheduledSyncSlot(dateUtc, hour);
  pruneScheduledSyncSlots(dateUtc);

  try {
    const result = await syncGgscoreData(getGgscoreClient(), "full");
    if (result.requestsUsed > 0) recordHeavySyncTime();
    console.log(
      `Scheduled sync (${hour}:00 UTC): fetched ${result.fetched.join(", ") || "nothing"}, remaining ${result.requestsRemaining}`,
    );
    if (result.errors.length > 0) {
      console.warn("Scheduled sync errors:", result.errors.join("; "));
    }
  } catch (error) {
    clearScheduledSyncSlot(dateUtc, hour);
    console.warn("Scheduled sync failed:", error);
  }
}

export class ScheduledSyncService {
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly checkIntervalMs = 60_000;

  constructor(private readonly hoursUtc: number[]) {}

  start(): void {
    if (this.hoursUtc.length === 0 || this.timer) return;
    console.log(
      `Scheduled GGScore sync enabled at UTC hour(s): ${this.hoursUtc.join(", ")}`,
    );
    void tickScheduledSync(this.hoursUtc);
    this.timer = setInterval(() => {
      void tickScheduledSync(this.hoursUtc);
    }, this.checkIntervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
