import "dotenv/config";
import type { EnvConfig } from "./types/index.js";

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
      `${name} is still set to the .env.example placeholder. Copy .env.example to .env and add your real credentials.`,
    );
  }
  return value;
}

export function loadConfig(): EnvConfig {
  return {
    discordToken: requireEnv("DISCORD_TOKEN"),
    discordClientId: requireEnv("DISCORD_CLIENT_ID"),
    discordGuildId: process.env.DISCORD_GUILD_ID || undefined,
    pollIntervalMs: Number(process.env.POLL_INTERVAL_MS ?? 600_000),
    ggscoreApiKey: requireEnv("GGSCORE_API_KEY"),
    ggscoreBaseUrl: process.env.GGSCORE_BASE_URL ?? "https://ggscore.net",
    ggscoreDailyLimit: Number(process.env.GGSCORE_DAILY_LIMIT ?? 3),
    ggscoreSyncOnStart: process.env.GGSCORE_SYNC_ON_START === "true",
  };
}
