import {
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  Client,
  Collection,
  Events,
  GatewayIntentBits,
  REST,
  Routes,
} from "discord.js";
import type {
  SlashCommandBuilder,
  SlashCommandOptionsOnlyBuilder,
  SlashCommandSubcommandsOnlyBuilder,
} from "discord.js";
import type { EnvConfig } from "../types/index.js";
import { handleBettingButton, handleBettingModal } from "./handlers/betting.handler.js";
import { handleDemoButton, handleDemoModal } from "./handlers/demo.handler.js";
import { handleMatchBoardButton } from "./handlers/match-board.handler.js";

export interface BotCommand {
  data:
    | SlashCommandBuilder
    | SlashCommandOptionsOnlyBuilder
    | SlashCommandSubcommandsOnlyBuilder
    | Omit<SlashCommandBuilder, "addSubcommand" | "addSubcommandGroup">;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
  autocomplete?: (interaction: AutocompleteInteraction) => Promise<void>;
  /** Only registered in DEV_GUILD_ID; not shown to normal servers. */
  devOnly?: boolean;
}

export function createClient(): Client {
  return new Client({
    intents: [GatewayIntentBits.Guilds],
  });
}

function toBody(commands: BotCommand[]): object[] {
  return commands.map((cmd) => cmd.data.toJSON());
}

export async function registerCommands(
  clientId: string,
  token: string,
  commands: BotCommand[],
  options?: { guildId?: string; devGuildId?: string },
): Promise<void> {
  const rest = new REST({ version: "10" }).setToken(token);
  const publicCommands = commands.filter((cmd) => !cmd.devOnly);
  const publicBody = toBody(publicCommands);
  const fullBody = toBody(commands);
  const guildId = options?.guildId;
  const devGuildId = options?.devGuildId;

  if (guildId) {
    const body = guildId === devGuildId ? fullBody : publicBody;
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body });
    console.log(
      `Registered ${body.length} guild commands for ${guildId}` +
        (guildId === devGuildId ? " (includes dev)" : ""),
    );
  } else {
    await rest.put(Routes.applicationCommands(clientId), { body: publicBody });
    console.log(`Registered ${publicBody.length} global commands`);
  }

  if (devGuildId && devGuildId !== guildId) {
    await rest.put(Routes.applicationGuildCommands(clientId, devGuildId), { body: fullBody });
    console.log(`Registered ${fullBody.length} commands (incl. /demo /test) for DEV_GUILD_ID ${devGuildId}`);
  } else if (!devGuildId) {
    const skipped = commands.filter((cmd) => cmd.devOnly).map((cmd) => `/${cmd.data.name}`);
    if (skipped.length > 0) {
      console.log(`Dev commands hidden (set DEV_GUILD_ID to enable): ${skipped.join(", ")}`);
    }
  }
}

function canRunDevCommand(
  interaction: ChatInputCommandInteraction | AutocompleteInteraction,
  config: Pick<EnvConfig, "devGuildId" | "devUserIds">,
): boolean {
  if (config.devGuildId && interaction.guildId !== config.devGuildId) return false;
  if (config.devUserIds.length === 0) return true;
  return config.devUserIds.includes(interaction.user.id);
}

export function attachCommandHandler(
  client: Client,
  commands: BotCommand[],
  config: Pick<EnvConfig, "devGuildId" | "devUserIds">,
): void {
  const commandMap = new Collection<string, BotCommand>();
  for (const command of commands) {
    commandMap.set(command.data.name, command);
  }

  client.once(Events.ClientReady, (readyClient) => {
    console.log(`Logged in as ${readyClient.user.tag}`);
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    if (interaction.isAutocomplete()) {
      const command = commandMap.get(interaction.commandName);
      if (command?.autocomplete) {
        if (command.devOnly && !canRunDevCommand(interaction, config)) {
          await interaction.respond([]);
          return;
        }
        try {
          await command.autocomplete(interaction);
        } catch (error) {
          console.error(`Autocomplete /${interaction.commandName} failed:`, error);
        }
      }
      return;
    }

    if (interaction.isButton()) {
      try {
        const handledDemo = await handleDemoButton(interaction);
        if (handledDemo) return;

        const handledBet = await handleBettingButton(interaction);
        if (handledBet) return;

        const handled = await handleMatchBoardButton(interaction);
        if (handled) return;
      } catch (error) {
        console.error("Button interaction failed:", error);
        const message = "Something went wrong handling that button.";
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ content: message, ephemeral: true });
        } else {
          await interaction.reply({ content: message, ephemeral: true });
        }
      }
      return;
    }

    if (interaction.isModalSubmit()) {
      try {
        const handledDemo = await handleDemoModal(interaction);
        if (handledDemo) return;

        const handled = await handleBettingModal(interaction);
        if (handled) return;
      } catch (error) {
        console.error("Modal interaction failed:", error);
        const message = "Something went wrong handling that form.";
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ content: message, ephemeral: true });
        } else {
          await interaction.reply({ content: message, ephemeral: true });
        }
      }
      return;
    }

    if (!interaction.isChatInputCommand()) return;

    const command = commandMap.get(interaction.commandName);
    if (!command) return;

    if (command.devOnly && !canRunDevCommand(interaction, config)) {
      await interaction.reply({
        content: "That command is only available in the developer test server.",
        ephemeral: true,
      });
      return;
    }

    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(`Command /${interaction.commandName} failed:`, error);
      const message = "Something went wrong running that command.";
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: message, ephemeral: true });
      } else {
        await interaction.reply({ content: message, ephemeral: true });
      }
    }
  });
}
