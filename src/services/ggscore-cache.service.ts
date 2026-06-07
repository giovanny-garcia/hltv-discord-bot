import type { GgscoreMatch } from "../types/ggscore.js";
import { extractList, GgscoreClient } from "./ggscore.service.js";
import type {
  GgscoreCacheKey,
  GgscoreCountry,
  GgscoreSyncResult,
  GgscoreSyncScope,
} from "../types/ggscore.js";
import { getGgscoreCache } from "../storage/db.js";

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

const SCOPE_TO_KEYS: Record<GgscoreSyncScope, GgscoreCacheKey[]> = {
  upcoming: ["upcoming_matches"],
  results: ["matches"],
  countries: ["countries"],
  full: ["upcoming_matches", "matches", "countries"],
};

export async function syncGgscoreData(
  client: GgscoreClient,
  scope: GgscoreSyncScope,
): Promise<GgscoreSyncResult> {
  const fetched: GgscoreCacheKey[] = [];
  const errors: string[] = [];
  const quotaBefore = client.getQuota().used;

  const run = async (key: GgscoreCacheKey): Promise<void> => {
    try {
      if (key === "countries") await client.fetchCountries();
      if (key === "matches") await client.fetchPlayedMatches();
      if (key === "upcoming_matches") await client.fetchUpcomingMatches();
      fetched.push(key);
    } catch (error) {
      errors.push(
        `${key}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  };

  for (const key of SCOPE_TO_KEYS[scope]) {
    await run(key);
  }

  const quota = client.getQuota();

  return {
    scope,
    fetched,
    requestsUsed: quota.used - quotaBefore,
    requestsRemaining: quota.remaining,
    errors,
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
