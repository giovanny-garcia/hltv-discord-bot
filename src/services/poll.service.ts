import type { Client } from "discord.js";
import type { EnvConfig } from "../types/index.js";
import { usesGgscore, usesHltv } from "../config.js";
import { announceAllGuilds } from "./announce.service.js";
import { announceGgscoreAllGuilds } from "./ggscore-announce.service.js";
import { fetchEvents, fetchMatches } from "./hltv.service.js";

const MAX_BACKOFF_MS = 60 * 60 * 1000;

export class PollService {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private baseIntervalMs: number;
  private currentIntervalMs: number;
  private running = false;

  constructor(
    private client: Client,
    private config: EnvConfig,
  ) {
    this.baseIntervalMs = config.pollIntervalMs;
    this.currentIntervalMs = config.pollIntervalMs;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    console.log(
      `Poll service started (interval: ${this.baseIntervalMs}ms, provider: ${this.config.dataProvider})`,
    );
    void this.scheduleNext(0);
  }

  stop(): void {
    this.running = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    console.log("Poll service stopped");
  }

  private scheduleNext(delayMs: number): void {
    if (!this.running) return;
    this.timer = setTimeout(() => void this.runPoll(), delayMs);
  }

  private async runPoll(): Promise<void> {
    if (!this.running) return;

    try {
      if (usesHltv(this.config)) {
        console.log("Polling HLTV...");
        const [events, matches] = await Promise.all([fetchEvents(), fetchMatches()]);
        await announceAllGuilds(this.client, events, matches);
        console.log(`HLTV poll complete: ${events.length} events, ${matches.length} matches`);
      }

      if (usesGgscore(this.config)) {
        console.log("Processing GGScore cache for announcements...");
        const matchCount = await announceGgscoreAllGuilds(this.client);
        console.log(`GGScore announce pass complete: ${matchCount} cached upcoming matches`);
      }

      this.currentIntervalMs = this.baseIntervalMs;
    } catch (error) {
      this.currentIntervalMs = Math.min(this.currentIntervalMs * 2, MAX_BACKOFF_MS);
      console.error("Poll failed, backing off:", error);
      console.log(`Next poll in ${this.currentIntervalMs}ms`);
    }

    this.scheduleNext(this.currentIntervalMs);
  }
}
