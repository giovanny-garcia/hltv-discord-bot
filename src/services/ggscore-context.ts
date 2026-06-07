import type { EnvConfig } from "../types/index.js";
import { GgscoreClient } from "./ggscore.service.js";

let client: GgscoreClient | null = null;

export function initGgscoreClient(config: EnvConfig): GgscoreClient {
  client = new GgscoreClient({
    apiKey: config.ggscoreApiKey,
    baseUrl: config.ggscoreBaseUrl,
    dailyLimit: config.ggscoreDailyLimit,
  });
  return client;
}

export function getGgscoreClient(): GgscoreClient {
  if (!client) {
    throw new Error("GGScore client is not initialized. Set GGSCORE_API_KEY in .env.");
  }
  return client;
}
