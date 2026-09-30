import type { GgscoreMatch } from "../types/ggscore.js";
import { extractList, GgscoreClient, scheduleHorizonLabel } from "./ggscore.service.js";
import type {
  GgscoreCacheKey,
  GgscoreCountry,
  GgscoreSyncResult,
  GgscoreSyncScope,
} from "../types/ggscore.js";
import { getGgscoreCache } from "../storage/db.js";
import { getGgscoreQuotaPolicy } from "./ggscore-context.js";

/** Hard ceiling so one sync cannot page through the whole catalog. */
export const ABSOLUTE_MAX_UPCOMING_PAGES = 20;

/**
 * How many upcoming pages a heavy sync may fetch.
 * Full sync holds one extra call above the reserve for the results request.
 */
export function planUpcomingPages(options: {
  remaining: number;
  reserveCalls: number;
  maxUpcomingPages: number;
  scope: GgscoreSyncScope;
}): number {
  if (options.scope !== "upcoming" && options.scope !== "full") return 0;
  const holdBack = options.reserveCalls + (options.scope === "full" ? 1 : 0);
  const available = Math.max(0, options.remaining - holdBack);
  const cap = Math.min(
    Math.max(0, options.maxUpcomingPages),
    ABSOLUTE_MAX_UPCOMING_PAGES,
  );
  return Math.min(cap, available);
}

export function getCachedCountries(): GgscoreCountry[] {
  const cached = getGgscoreCache<unknown>("countries");
  return extractList<GgscoreCountry>(cached?.payload as never);
}

export function getCachedPlayedMatches(): GgscoreMatch[] {
  const cached = getGgscoreCache<unknown>("matches");
  return extractList<GgscoreMatch>(cached?.payload as never);
}

export function getCachedUpcomingMatches(): GgscoreMatch[] {
  const cached = getGgscoreCache<unknown>("upcoming_matches");
  return extractList<GgscoreMatch>(cached?.payload as never);
}

export function hasGgscoreCache(key: GgscoreCacheKey): boolean {
  return getGgscoreCache(key) !== null;
}

export function getUpcomingScheduleHorizon(): string | null {
  return scheduleHorizonLabel(getCachedUpcomingMatches());
}

export async function syncGgscoreData(
  client: GgscoreClient,
  scope: GgscoreSyncScope,
): Promise<GgscoreSyncResult> {
  const fetched: GgscoreCacheKey[] = [];
  const errors: string[] = [];
  const quotaBefore = client.getQuota().used;
  let horizon: string | undefined;
  const policy = getGgscoreQuotaPolicy();

  const runUpcoming = async (): Promise<void> => {
    const remaining = client.getQuota().remaining;
    const maxPages = planUpcomingPages({
      remaining,
      reserveCalls: policy.reserveCalls,
      maxUpcomingPages: policy.maxUpcomingPages,
      scope,
    });
    if (maxPages <= 0) {
      if (remaining <= 0) errors.push("upcoming_matches: no API quota remaining");
      return;
    }
    const holdBack = policy.reserveCalls + (scope === "full" ? 1 : 0);
    try {
      const result = await client.fetchUpcomingMatches(maxPages, holdBack);
      if (result.pagesFetched === 0) return;
      fetched.push("upcoming_matches");
      horizon = scheduleHorizonLabel(result.matches) ?? undefined;
    } catch (error) {
      errors.push(
        `upcoming_matches: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  };

  const run = async (key: Exclude<GgscoreCacheKey, "upcoming_matches">): Promise<void> => {
    try {
      if (key === "countries") await client.fetchCountries();
      if (key === "matches") await client.fetchPlayedMatches();
      fetched.push(key);
    } catch (error) {
      errors.push(
        `${key}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  };

  if (scope === "upcoming" || scope === "full") {
    await runUpcoming();
  }
  // Results and countries commands may spend the reserve. A full sync's results
  // call stays above it, so scheduled syncs cannot eat the calls kept for later.
  if (scope === "results" && client.getQuota().remaining > 0) {
    await run("matches");
  }
  if (scope === "full" && client.getQuota().remaining > policy.reserveCalls) {
    await run("matches");
  }
  if (scope === "countries" && client.getQuota().remaining > 0) {
    await run("countries");
  }

  const quota = client.getQuota();

  return {
    scope,
    fetched,
    requestsUsed: quota.used - quotaBefore,
    requestsRemaining: quota.remaining,
    errors,
    horizon,
  };
}

export function formatCacheAge(fetchedAt: number): string {
  const minutes = Math.floor((Date.now() - fetchedAt) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
