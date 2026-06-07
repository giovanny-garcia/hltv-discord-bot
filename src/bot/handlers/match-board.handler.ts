import type { ButtonInteraction } from "discord.js";
import { handleMatchBoardButton as handleBoardButton } from "../../test/test.service.js";

export async function handleMatchBoardButton(interaction: ButtonInteraction): Promise<boolean> {
  return handleBoardButton(interaction);
}
