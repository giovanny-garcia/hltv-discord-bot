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

  private async request<T>(path: string, cacheKey: string): Promise<T> {
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

    const payload = (await response.json()) as T;
    setGgscoreCache(cacheKey, payload);
    return payload;
  }

  fetchCountries(): Promise<GgscorePaginatedResponse<GgscoreCountry> | GgscoreCountry[]> {
    return this.request("/api/v2/countries", "countries");
  }

  fetchPlayedMatches(limit = 50, offset = 0): Promise<GgscorePaginatedResponse<GgscoreMatch>> {
    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
    });
    return this.request(`/api/v2/matches?${params}`, "matches");
  }

  fetchUpcomingMatches(limit = 50, offset = 0): Promise<GgscorePaginatedResponse<GgscoreMatch>> {
    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
    });
    return this.request(`/api/v2/upcoming_matches?${params}`, "upcoming_matches");
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
