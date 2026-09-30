import type { ButtonInteraction } from "discord.js";
import { handleMatchBoardButton as handleTestBoardButton } from "../../test/test.service.js";
import {
  getLifecycleSession,
  setLifecycleBoardJson,
  updateLifecycleSession,
} from "../../storage/lifecycle-storage.js";
import {
  parseMatchBoardRevealId,
  revealMatchBoard,
  type MatchBoardData,
} from "../../utils/match-board.embed.js";

export async function handleMatchBoardButton(interaction: ButtonInteraction): Promise<boolean> {
  const matchId = parseMatchBoardRevealId(interaction.customId);
  if (!matchId) return false;

  if (interaction.guildId) {
    const session = getLifecycleSession(interaction.guildId, matchId);
    if (session?.boardJson) {
      const board = JSON.parse(session.boardJson) as MatchBoardData;
      const revealedBoard = { ...board, hideSpoilers: false };
      await interaction.update(revealMatchBoard(revealedBoard));
      setLifecycleBoardJson(
        interaction.guildId,
        matchId,
        JSON.stringify(revealedBoard),
        false,
      );
      updateLifecycleSession(session.id, { hideSpoilers: false });
      return true;
    }
  }

  return handleTestBoardButton(interaction);
}
