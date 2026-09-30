import type {
  GgscoreCountry,
  GgscoreMatch,
  GgscorePaginatedResponse,
} from "../types/ggscore.js";
import { getGgscoreUsage, incrementGgscoreUsage, setGgscoreCache } from "../storage/db.js";

export class GgscoreQuotaExceededError extends Error {
  constructor(
    public readonly used: number,
    public readonly limit: number,
  ) {
    super(`GGScore daily quota exceeded (${used}/${limit}). Try again tomorrow or upgrade your plan.`);
    this.name = "GgscoreQuotaExceededError";
  }
}

export class GgscoreApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "GgscoreApiError";
  }
}

interface GgscoreClientOptions {
  apiKey: string;
  baseUrl: string;
  dailyLimit: number;
}

const DEFAULT_PAGE_SIZE = 50;
const MAX_UPCOMING_PAGES = 20;

export class GgscoreClient {
  constructor(private readonly options: GgscoreClientOptions) {}

  getQuota(): { used: number; limit: number; remaining: number; date: string } {
    const used = getGgscoreUsage();
    const limit = this.options.dailyLimit;
    return {
      date: new Date().toISOString().slice(0, 10),
      used,
      limit,
      remaining: Math.max(0, limit - used),
    };
  }

  private assertQuotaAvailable(): void {
    const { used, limit } = this.getQuota();
    if (used >= limit) {
      throw new GgscoreQuotaExceededError(used, limit);
    }
  }

  private async requestJson(path: string): Promise<unknown> {
    this.assertQuotaAvailable();

    const url = new URL(path, this.options.baseUrl);
    const response = await fetch(url, {
      headers: {
        "X-API-Key": this.options.apiKey,
        Accept: "application/json",
      },
    });

    incrementGgscoreUsage(1);

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new GgscoreApiError(
        `GGScore ${path} failed (${response.status}): ${body || response.statusText}`,
        response.status,
      );
    }

    return response.json();
  }

  fetchCountries(): Promise<GgscorePaginatedResponse<GgscoreCountry> | GgscoreCountry[]> {
    return this.requestJson("/api/v2/countries").then((payload) => {
      setGgscoreCache("countries", payload);
      return payload as GgscorePaginatedResponse<GgscoreCountry> | GgscoreCountry[];
    });
  }

  fetchPlayedMatches(limit = DEFAULT_PAGE_SIZE, page = 1): Promise<GgscorePaginatedResponse<GgscoreMatch>> {
    const params = new URLSearchParams({
      limit: String(limit),
      page: String(page),
    });
    return this.requestJson(`/api/v2/matches?${params}`).then((payload) => {
      setGgscoreCache("matches", payload);
      return payload as GgscorePaginatedResponse<GgscoreMatch>;
    });
  }

  /**
   * Pulls several upcoming pages into one cache entry.
   * Each page costs one API request. Stops on a short page, when quota runs out,
   * or when remaining calls would drop to `minRemaining` (the results reserve).
   * A zero page budget does not overwrite the cache.
   */
  async fetchUpcomingMatches(maxPages = 1, minRemaining = 0): Promise<{
    matches: GgscoreMatch[];
    pagesFetched: number;
  }> {
    const pages = Math.min(Math.max(0, maxPages), MAX_UPCOMING_PAGES);
    if (pages === 0 || this.getQuota().remaining <= minRemaining) {
      return { matches: [], pagesFetched: 0 };
    }

    const byId = new Map<string, GgscoreMatch>();
    let pagesFetched = 0;

    for (let page = 1; page <= pages; page++) {
      if (this.getQuota().remaining <= minRemaining) break;

      const params = new URLSearchParams({
        limit: String(DEFAULT_PAGE_SIZE),
        page: String(page),
      });
      const payload = (await this.requestJson(
        `/api/v2/upcoming_matches?${params}`,
      )) as GgscorePaginatedResponse<GgscoreMatch>;
      pagesFetched += 1;

      const list = extractList(payload);
      for (const match of list) {
        const id =
          match.id !== undefined
            ? String(match.id)
            : `${match.play_at ?? ""}-${JSON.stringify(match.team1)}-${JSON.stringify(match.team2)}`;
        byId.set(id, match);
      }

      if (list.length < DEFAULT_PAGE_SIZE) break;
    }

    if (pagesFetched === 0) return { matches: [], pagesFetched: 0 };

    const matches = [...byId.values()];
    setGgscoreCache("upcoming_matches", { data: matches });
    return { matches, pagesFetched };
  }
}

export function extractList<T>(payload: GgscorePaginatedResponse<T> | T[] | null | undefined): T[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.items)) return payload.items;
  if (Array.isArray(payload.results)) return payload.results;
  if (Array.isArray(payload.matches)) return payload.matches as T[];
  if (Array.isArray(payload.countries)) return payload.countries as T[];
  return [];
}

export function scheduleHorizonLabel(matches: GgscoreMatch[]): string | null {
  const times = matches
    .map((match) => Date.parse(String(match.play_at ?? match.scheduled_at ?? match.date ?? "")))
    .filter((ms) => Number.isFinite(ms))
    .sort((a, b) => a - b);
  if (times.length === 0) return null;

  const latest = times[times.length - 1];
  const days = Math.max(0, Math.ceil((latest - Date.now()) / 86_400_000));
  const when = new Date(latest).toISOString().slice(0, 10);
  return `${matches.length} matches through ${when} (~${days} day${days === 1 ? "" : "s"} ahead)`;
}
