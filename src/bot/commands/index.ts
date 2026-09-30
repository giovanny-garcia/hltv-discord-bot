import type { BotCommand } from "../client.js";
import { balanceCommand } from "./balance.js";
import { bettingCommand } from "./betting.js";
import { countriesCommand } from "./countries.js";
import { demoCommand } from "./demo.js";
import { eventsCommand } from "./events.js";
import { helpCommand } from "./help.js";
import { leaderboardCommand } from "./leaderboard.js";
import { matchesCommand } from "./matches.js";
import { nextCommand } from "./next.js";
import { pingCommand } from "./ping.js";
import { quotaCommand } from "./quota.js";
import { resultsCommand } from "./results.js";
import { scoreboardCommand } from "./scoreboard.js";
import { setupCommand } from "./setup.js";
import {
  settingsCommand,
  subscribeCommand,
  unsubscribeCommand,
} from "./subscribe.js";
import { syncCommand } from "./sync.js";
import { testCommand } from "./test.js";
import { timezoneCommand } from "./timezone.js";

export const commands: BotCommand[] = [
  pingCommand,
  helpCommand,
  setupCommand,
  subscribeCommand,
  unsubscribeCommand,
  settingsCommand,
  balanceCommand,
  bettingCommand,
  demoCommand,
  leaderboardCommand,
  eventsCommand,
  matchesCommand,
  nextCommand,
  syncCommand,
  quotaCommand,
  resultsCommand,
  scoreboardCommand,
  countriesCommand,
  testCommand,
  timezoneCommand,
];
