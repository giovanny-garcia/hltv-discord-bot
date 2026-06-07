import type { BotCommand } from "../client.js";
import { eventsCommand } from "./events.js";
import {
  ggscoreCountriesCommand,
  ggscoreEventsCommand,
  ggscoreQuotaCommand,
  ggscoreResultsCommand,
  ggscoreSyncCommand,
  ggscoreUpcomingCommand,
} from "./ggscore.js";
import { matchesCommand } from "./matches.js";
import { pingCommand } from "./ping.js";
import {
  settingsCommand,
  subscribeCommand,
  unsubscribeCommand,
} from "./subscribe.js";

const baseCommands: BotCommand[] = [
  pingCommand,
  subscribeCommand,
  unsubscribeCommand,
  settingsCommand,
  eventsCommand,
  matchesCommand,
];

const ggscoreCommands: BotCommand[] = [
  ggscoreSyncCommand,
  ggscoreQuotaCommand,
  ggscoreUpcomingCommand,
  ggscoreResultsCommand,
  ggscoreCountriesCommand,
  ggscoreEventsCommand,
];

export function buildCommands(includeGgscore: boolean): BotCommand[] {
  return includeGgscore ? [...baseCommands, ...ggscoreCommands] : baseCommands;
}

export const commands = baseCommands;
