import type { BotCommand } from "../client.js";
import { countriesCommand } from "./countries.js";
import { eventsCommand } from "./events.js";
import { matchesCommand } from "./matches.js";
import { pingCommand } from "./ping.js";
import { quotaCommand } from "./quota.js";
import { resultsCommand } from "./results.js";
import {
  settingsCommand,
  subscribeCommand,
  unsubscribeCommand,
} from "./subscribe.js";
import { syncCommand } from "./sync.js";
import { testAnnounceCommand } from "./test-announce.js";

export const commands: BotCommand[] = [
  pingCommand,
  subscribeCommand,
  unsubscribeCommand,
  settingsCommand,
  eventsCommand,
  matchesCommand,
  syncCommand,
  quotaCommand,
  resultsCommand,
  countriesCommand,
  testAnnounceCommand,
];
