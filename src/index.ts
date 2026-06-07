import { loadConfig, usesGgscore } from "./config.js";
import { attachCommandHandler, createClient, registerCommands } from "./bot/client.js";
import { buildCommands } from "./bot/commands/index.js";
import { initGgscoreClient } from "./services/ggscore-context.js";
import { syncGgscoreData } from "./services/ggscore-cache.service.js";
import { PollService } from "./services/poll.service.js";
import { closeDb, initDb } from "./storage/db.js";

async function main(): Promise<void> {
  const config = loadConfig();
  initDb();

  const includeGgscore = usesGgscore(config);
  if (includeGgscore) {
    initGgscoreClient(config);
  }

  const client = createClient();
  const commands = buildCommands(includeGgscore);
  attachCommandHandler(client, commands);

  await registerCommands(
    config.discordClientId,
    config.discordToken,
    commands,
    config.discordGuildId,
  );

  const pollService = new PollService(client, config);

  client.once("ready", () => {
    pollService.start();

    if (includeGgscore && config.ggscoreSyncOnStart) {
      void syncGgscoreData(getGgscoreClient(), "full")
        .then((result) => {
          console.log(
            `Startup GGScore sync: fetched ${result.fetched.join(", ")}, remaining ${result.requestsRemaining}`,
          );
        })
        .catch((error) => {
          console.warn("Startup GGScore sync skipped/failed:", error);
        });
    } else if (includeGgscore) {
      console.log(
        "GGScore: no startup sync (GGSCORE_SYNC_ON_START=false). Run /ggscore-sync scope:full once to populate cache.",
      );
    }
  });

  const shutdown = (): void => {
    console.log("Shutting down...");
    pollService.stop();
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
