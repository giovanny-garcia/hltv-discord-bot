import "dotenv/config";
import type { DataProvider, EnvConfig } from "./types/index.js";

const PLACEHOLDER_VALUES = new Set([
  "your_bot_token_here",
  "your_application_client_id_here",
  "your_ggscore_api_key_here",
]);

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  if (PLACEHOLDER_VALUES.has(value)) {
    throw new Error(
      `${name} is still set to the .env.example placeholder. Copy .env.example to .env and replace it with real credentials from the Discord Developer Portal.`,
    );
  }
  return value;
}

function parseDataProvider(value: string | undefined): DataProvider {
  const provider = (value ?? "hltv").toLowerCase();
  if (provider === "hltv" || provider === "ggscore" || provider === "both") {
    return provider;
  }
  throw new Error(`Invalid DATA_PROVIDER "${value}". Use hltv, ggscore, or both.`);
}

export function loadConfig(): EnvConfig {
  const dataProvider = parseDataProvider(process.env.DATA_PROVIDER);
  const ggscoreApiKey = process.env.GGSCORE_API_KEY || undefined;

  if ((dataProvider === "ggscore" || dataProvider === "both") && !ggscoreApiKey) {
    throw new Error("GGSCORE_API_KEY is required when DATA_PROVIDER is ggscore or both");
  }
  if (
    ggscoreApiKey &&
    PLACEHOLDER_VALUES.has(ggscoreApiKey) &&
    (dataProvider === "ggscore" || dataProvider === "both")
  ) {
    throw new Error(
      "GGSCORE_API_KEY is still set to the .env.example placeholder. Add a real key from https://ggscore.net or set DATA_PROVIDER=hltv.",
    );
  }

  return {
    discordToken: requireEnv("DISCORD_TOKEN"),
    discordClientId: requireEnv("DISCORD_CLIENT_ID"),
    discordGuildId: process.env.DISCORD_GUILD_ID || undefined,
    pollIntervalMs: Number(process.env.POLL_INTERVAL_MS ?? 600_000),
    dataProvider,
    ggscoreApiKey,
    ggscoreBaseUrl: process.env.GGSCORE_BASE_URL ?? "https://ggscore.net",
    ggscoreDailyLimit: Number(process.env.GGSCORE_DAILY_LIMIT ?? 3),
    ggscoreSyncOnStart: process.env.GGSCORE_SYNC_ON_START === "true",
  };
}

export function usesHltv(config: EnvConfig): boolean {
  return config.dataProvider === "hltv" || config.dataProvider === "both";
}

export function usesGgscore(config: EnvConfig): boolean {
  return config.dataProvider === "ggscore" || config.dataProvider === "both";
}
