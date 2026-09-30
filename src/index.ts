import { Events } from "discord.js";
import { loadConfig } from "./config.js";
import { attachCommandHandler, createClient, registerCommands } from "./bot/client.js";
import { commands } from "./bot/commands/index.js";
import { getGgscoreClient, initGgscoreClient } from "./services/ggscore-context.js";
import { syncGgscoreData } from "./services/ggscore-cache.service.js";
import { ScheduledSyncService, recordHeavySyncTime } from "./services/ggscore-sync-guard.js";
import { PollService } from "./services/poll.service.js";
import { MatchLifecycleService } from "./services/match-lifecycle.service.js";
import { closeDb, initDb } from "./storage/db.js";

async function main(): Promise<void> {
  const config = loadConfig();
  initDb();
  initGgscoreClient(config);

  const client = createClient();
  attachCommandHandler(client, commands, config);

  await registerCommands(config.discordClientId, config.discordToken, commands, {
    guildId: config.discordGuildId,
    devGuildId: config.devGuildId,
  });

  const pollService = new PollService(client, config);
  const lifecycleService = new MatchLifecycleService(client, config.lifecycleIntervalMs);
  const scheduledSync = new ScheduledSyncService(config.ggscoreScheduledSyncHours);

  client.once(Events.ClientReady, () => {
    pollService.start();
    lifecycleService.start();
    scheduledSync.start();

    if (config.ggscoreSyncOnStart) {
      void syncGgscoreData(getGgscoreClient(), "full")
        .then((result) => {
          if (result.requestsUsed > 0) recordHeavySyncTime();
          console.log(
            `Startup sync: fetched ${result.fetched.join(", ")}, remaining ${result.requestsRemaining}`,
          );
        })
        .catch((error) => {
          console.warn("Startup sync skipped/failed:", error);
        });
    } else {
      console.log(
        "No startup sync (GGSCORE_SYNC_ON_START=false). Run /setup in Discord to load the schedule.",
      );
    }
  });

  const shutdown = (): void => {
    console.log("Shutting down...");
    pollService.stop();
    lifecycleService.stop();
    scheduledSync.stop();
    client.destroy();
    closeDb();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  await client.login(config.discordToken);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
