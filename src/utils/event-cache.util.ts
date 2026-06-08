import {
  getCachedPlayedMatches,
  getCachedUpcomingMatches,
} from "../services/ggscore-cache.service.js";
import {
  isUpcoming,
  normalizeGgscoreMatch,
  type NormalizedGgscoreMatch,
} from "./ggscore-match.util.js";
import type { TrackedEvent } from "../types/index.js";

export interface CachedEventOption {
  id: string;
  name: string;
  upcomingCount: number;
}

export function getCachedEventOptions(): CachedEventOption[] {
  const map = new Map<string, CachedEventOption>();

  for (const raw of [...getCachedUpcomingMatches(), ...getCachedPlayedMatches()]) {
    const match = normalizeGgscoreMatch(raw);
    if (!match.eventId && !match.eventName) continue;

    const id = match.eventId ?? match.eventName!;
    const name = match.eventName ?? id;
    const existing = map.get(id);

    if (existing) {
      if (isUpcoming(match)) existing.upcomingCount += 1;
    } else {
      map.set(id, { id, name, upcomingCount: isUpcoming(match) ? 1 : 0 });
    }
  }

  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function findCachedEvent(eventId: string): CachedEventOption | null {
  return getCachedEventOptions().find((event) => event.id === eventId) ?? null;
}

export function matchIsTracked(
  match: NormalizedGgscoreMatch,
  tracked: TrackedEvent[],
): boolean {
  if (tracked.length === 0) return false;
  if (!match.eventId && !match.eventName) return false;

  return tracked.some((entry) => {
    if (match.eventId && entry.eventId === match.eventId) return true;
    if (match.eventName && entry.eventName.toLowerCase() === match.eventName.toLowerCase()) {
      return true;
    }
    if (match.eventName && entry.eventId === match.eventName) return true;
    return false;
  });
}

export function filterTrackedMatches(
  matches: NormalizedGgscoreMatch[],
  tracked: TrackedEvent[],
): NormalizedGgscoreMatch[] {
  return matches.filter((match) => matchIsTracked(match, tracked));
}
