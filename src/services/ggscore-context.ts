import type { EnvConfig } from "../types/index.js";
import { GgscoreClient } from "./ggscore.service.js";

export interface GgscoreQuotaPolicy {
  maxUpcomingPages: number;
  reserveCalls: number;
  manualHeavySyncsPerDay: number;
  syncCooldownMs: number;
  scheduledSyncHours: number[];
}

let client: GgscoreClient | null = null;
let policy: GgscoreQuotaPolicy = {
  maxUpcomingPages: 3,
  reserveCalls: 1,
  manualHeavySyncsPerDay: 3,
  syncCooldownMs: 3_600_000,
  scheduledSyncHours: [],
};

export function initGgscoreClient(config: EnvConfig): GgscoreClient {
  client = new GgscoreClient({
    apiKey: config.ggscoreApiKey,
    baseUrl: config.ggscoreBaseUrl,
    dailyLimit: config.ggscoreDailyLimit,
  });
  policy = {
    maxUpcomingPages: config.ggscoreMaxUpcomingPages,
    reserveCalls: config.ggscoreReserveCalls,
    manualHeavySyncsPerDay: config.ggscoreManualHeavySyncsPerDay,
    syncCooldownMs: config.ggscoreSyncCooldownMs,
    scheduledSyncHours: config.ggscoreScheduledSyncHours,
  };
  return client;
}

export function getGgscoreClient(): GgscoreClient {
  if (!client) {
    throw new Error("GGScore client is not initialized. Set GGSCORE_API_KEY in .env.");
  }
  return client;
}

export function getGgscoreQuotaPolicy(): GgscoreQuotaPolicy {
  return policy;
}

export function getGgscoreScheduledSyncHours(): number[] {
  return policy.scheduledSyncHours;
}
