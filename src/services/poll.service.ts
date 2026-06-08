import type { Client } from "discord.js";
import type { EnvConfig } from "../types/index.js";
import { announceGgscoreAllGuilds } from "./ggscore-announce.service.js";

const MAX_BACKOFF_MS = 60 * 60 * 1000;

export class PollService {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private baseIntervalMs: number;
  private currentIntervalMs: number;
  private running = false;

  constructor(
    private client: Client,
    config: EnvConfig,
  ) {
    this.baseIntervalMs = config.pollIntervalMs;
    this.currentIntervalMs = config.pollIntervalMs;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    console.log(`Poll service started (interval: ${this.baseIntervalMs}ms)`);
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
      console.log("Processing cached matches for announcements...");
      const matchCount = await announceGgscoreAllGuilds(this.client);
      console.log(`Announce pass complete: ${matchCount} message(s) sent`);
      this.currentIntervalMs = this.baseIntervalMs;
    } catch (error) {
      this.currentIntervalMs = Math.min(this.currentIntervalMs * 2, MAX_BACKOFF_MS);
      console.error("Poll failed, backing off:", error);
      console.log(`Next poll in ${this.currentIntervalMs}ms`);
    }

    this.scheduleNext(this.currentIntervalMs);
  }
}
