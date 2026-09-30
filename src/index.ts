import { Events } from "discord.js";
import { loadConfig } from "./config.js";
import { attachCommandHandler, createClient, registerCommands } from "./bot/client.js";
import { commands } from "./bot/commands/index.js";
import { getGgscoreClient, initGgscoreClient } from "./services/ggscore-context.js";
import { syncGgscoreData } from "./services/ggscore-cache.service.js";
import { PollService } from "./services/poll.service.js";
import { MatchLifecycleService } from "./services/match-lifecycle.service.js";
import { closeDb, initDb } from "./storage/db.js";

async function main(): Promise<void> {
  const config = loadConfig();
  initDb();
  initGgscoreClient(config);

  const client = createClient();
  attachCommandHandler(client, commands);

  await registerCommands(
    config.discordClientId,
    config.discordToken,
    commands,
    config.discordGuildId,
  );

  const pollService = new PollService(client, config);
  const lifecycleService = new MatchLifecycleService(client, config.lifecycleIntervalMs);

  client.once(Events.ClientReady, () => {
    pollService.start();
    lifecycleService.start();

    if (config.ggscoreSyncOnStart) {
      void syncGgscoreData(getGgscoreClient(), "full")
        .then((result) => {
          console.log(
            `Startup sync: fetched ${result.fetched.join(", ")}, remaining ${result.requestsRemaining}`,
          );
        })
        .catch((error) => {
          console.warn("Startup sync skipped/failed:", error);
        });
    } else {
      console.log(
        "No startup sync (GGSCORE_SYNC_ON_START=false). Run /sync scope:full once to populate the cache.",
      );
    }
  });

  const shutdown = (): void => {
    console.log("Shutting down...");
    pollService.stop();
    lifecycleService.stop();
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
