import type { Client, TextChannel } from "discord.js";
import type { GuildSettings } from "../types/index.js";
import { lifecycleBoardFromSession, type MatchLifecycleSession } from "../types/lifecycle.js";
import {
  getLifecycleSession,
  getLifecycleSessionsForGuild,
  updateLifecycleSession,
} from "../storage/lifecycle-storage.js";
import { getGuildSettings } from "../storage/db.js";
import { getCachedPlayedMatches } from "./ggscore-cache.service.js";
import { findPlayedMatchSnapshot, type PlayedMatchSnapshot } from "../utils/ggscore-played.util.js";
import {
  buildMatchBoardComponents,
  buildMatchBoardEmbeds,
  matchBoardHeader,
  type MatchBoardData,
  type MatchBoardMap,
} from "../utils/match-board.embed.js";

async function fetchTextChannel(
  client: Client,
  channelId: string,
): Promise<TextChannel | null> {
  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel?.isTextBased() || channel.isDMBased()) return null;
  return channel as TextChannel;
}

/** Production scorecards stay visible — live ticker, not spoiler-gated. */
const VISIBLE_SCORES: Pick<MatchBoardData, "hideSpoilers" | "spoilersRevealed"> = {
  hideSpoilers: false,
  spoilersRevealed: true,
};

function boardDataEquals(a: MatchBoardData, b: MatchBoardData): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function mapsFromSnapshot(snapshot: PlayedMatchSnapshot | null): MatchBoardMap[] | undefined {
  if (!snapshot || snapshot.maps.length === 0) return undefined;
  return snapshot.maps.map((map, index) => ({
    name: map.name?.trim() || `Map ${index + 1}`,
    team1Rounds: map.team1Rounds,
    team2Rounds: map.team2Rounds,
    winnerSide: map.winnerSide,
    live: map.live,
  }));
}

export function buildBoardForSession(session: MatchLifecycleSession): MatchBoardData {
  const played = getCachedPlayedMatches();
  const snapshot = findPlayedMatchSnapshot(
    session.matchId,
    played,
    session.team1Name,
    session.team2Name,
  );
  if (session.status === "finished" || session.matchFinishSent) {
    return lifecycleBoardFromSession(
      {
        ...session,
        team1Series: snapshot?.team1Series ?? session.team1Series,
        team2Series: snapshot?.team2Series ?? session.team2Series,
        winnerSide: snapshot?.winnerSide ?? session.winnerSide,
      },
      "finished",
      {
        ...VISIBLE_SCORES,
        maps: mapsFromSnapshot(snapshot),
      },
    );
  }

  if (snapshot?.finished) {
    return lifecycleBoardFromSession(
      {
        ...session,
        team1Series: snapshot.team1Series,
        team2Series: snapshot.team2Series,
        winnerSide: snapshot.winnerSide,
      },
      "finished",
      {
        ...VISIBLE_SCORES,
        maps: mapsFromSnapshot(snapshot),
      },
    );
  }

  if (snapshot && snapshot.mapsCompleted > session.mapsAnnounced && !snapshot.finished) {
    return lifecycleBoardFromSession(
      {
        ...session,
        team1Series: snapshot.team1Series,
        team2Series: snapshot.team2Series,
      },
      "between_maps",
      {
        ...VISIBLE_SCORES,
        currentMap: snapshot.mapsCompleted,
        currentMapName: snapshot.lastCompletedMapName ?? snapshot.liveMap?.mapName,
        maps: mapsFromSnapshot(snapshot),
      },
    );
  }

  if (session.status === "live" || session.matchStartSent) {
    const currentMap = Math.max(1, snapshot?.liveMap?.mapIndex ?? snapshot?.mapsCompleted ?? session.mapsAnnounced + 1);
    const liveMap = snapshot?.liveMap;

    return lifecycleBoardFromSession(session, "live", {
      ...VISIBLE_SCORES,
      currentMap,
      currentMapName: liveMap?.mapName,
      team1: {
        seriesScore: snapshot?.team1Series ?? session.team1Series,
        mapScore: liveMap?.team1MapScore,
        playingSide: liveMap?.team1Side,
      },
      team2: {
        seriesScore: snapshot?.team2Series ?? session.team2Series,
        mapScore: liveMap?.team2MapScore,
        playingSide: liveMap?.team2Side,
      },
      maps: mapsFromSnapshot(snapshot),
    });
  }

  if (session.status === "betting_open" || session.bettingOpenSent) {
    const scheduledInMinutes = Math.max(
      0,
      Math.round((session.scheduledAt * 1000 - Date.now()) / 60_000),
    );
    return lifecycleBoardFromSession(session, "upcoming", {
      ...VISIBLE_SCORES,
      scheduledInMinutes,
    });
  }

  if (session.boardJson) {
    try {
      const saved = JSON.parse(session.boardJson) as MatchBoardData;
      return { ...saved, ...VISIBLE_SCORES };
    } catch {
      // fall through
    }
  }

  return lifecycleBoardFromSession(session, "upcoming", VISIBLE_SCORES);
}

export async function deleteScoreboardMessageIfExists(
  client: Client,
  boardChannelId?: string,
  boardMessageId?: string,
): Promise<void> {
  if (!boardChannelId || !boardMessageId) return;

  const channel = await fetchTextChannel(client, boardChannelId);
  const message = await channel?.messages.fetch(boardMessageId).catch(() => null);
  if (message) {
    await message.delete().catch(() => {});
  }
}

export async function upsertScoreboard(
  client: Client,
  settings: GuildSettings,
  session: Pick<MatchLifecycleSession, "id" | "boardChannelId" | "boardMessageId">,
  board: MatchBoardData,
  header?: string,
): Promise<boolean> {
  const channel = await fetchTextChannel(client, settings.channelId);
  if (!channel) return false;

  const boardJson = JSON.stringify(board);
  const payload = {
    content: header,
    embeds: buildMatchBoardEmbeds(board),
    components: buildMatchBoardComponents(board),
  };

  if (session.boardMessageId && session.boardChannelId) {
    const existingChannel = await fetchTextChannel(client, session.boardChannelId);
    const message = await existingChannel?.messages.fetch(session.boardMessageId).catch(() => null);
    if (message) {
      await message.edit(payload);
      updateLifecycleSession(session.id, {
        boardChannelId: session.boardChannelId,
        boardMessageId: session.boardMessageId,
        boardJson,
        hideSpoilers: board.hideSpoilers,
      });
      return true;
    }
  }

  const message = await channel.send(payload);
  updateLifecycleSession(session.id, {
    boardChannelId: channel.id,
    boardMessageId: message.id,
    boardJson,
    hideSpoilers: board.hideSpoilers,
  });
  return true;
}

export async function repostScoreboard(
  client: Client,
  guildId: string,
  matchId: string,
): Promise<{ messageUrl: string } | null> {
  const settings = getGuildSettings(guildId);
  if (!settings) {
    throw new Error("Run `/setup` or `/subscribe` first to configure an announcement channel.");
  }

  const session = getLifecycleSession(guildId, matchId);
  if (!session) {
    throw new Error(
      `No lifecycle session for match \`${matchId}\`. Track the event or run a sync first.`,
    );
  }

  await deleteScoreboardMessageIfExists(
    client,
    session.boardChannelId,
    session.boardMessageId,
  );

  const refreshed = getLifecycleSession(guildId, matchId)!;
  const board = buildBoardForSession(refreshed);
  const header = matchBoardHeader(board);
  const posted = await upsertScoreboard(client, settings, refreshed, board, header);
  if (!posted) {
    throw new Error("Could not post scorecard — check bot permissions in the announcement channel.");
  }

  const updated = getLifecycleSession(guildId, matchId);
  if (!updated?.boardChannelId || !updated.boardMessageId) return null;

  return {
    messageUrl: `https://discord.com/channels/${guildId}/${updated.boardChannelId}/${updated.boardMessageId}`,
  };
}

export async function repostAllScoreboards(
  client: Client,
  guildId: string,
): Promise<{ reposted: number; failed: string[] }> {
  const sessions = getLifecycleSessionsForGuild(guildId).filter(
    (session) =>
      session.bettingOpenSent ||
      session.matchStartSent ||
      session.matchFinishSent ||
      session.boardMessageId,
  );

  let reposted = 0;
  const failed: string[] = [];

  for (const session of sessions) {
    try {
      const result = await repostScoreboard(client, guildId, session.matchId);
      if (result) reposted++;
    } catch (error) {
      const label = `${session.team1Name} vs ${session.team2Name}`;
      failed.push(`${label}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return { reposted, failed };
}

export async function refreshScoreboardFromSession(
  client: Client,
  settings: GuildSettings,
  session: MatchLifecycleSession,
): Promise<void> {
  const fresh = getLifecycleSession(session.guildId, session.matchId) ?? session;
  const board = buildBoardForSession(fresh);

  if (fresh.boardJson) {
    try {
      const previous = JSON.parse(fresh.boardJson) as MatchBoardData;
      if (boardDataEquals(previous, board)) return;
    } catch {
      // continue with edit
    }
  }

  const header = matchBoardHeader(board);
  await upsertScoreboard(client, settings, fresh, board, header);
}

export async function healMissingScoreboards(
  client: Client,
  settings: GuildSettings,
  sessions: MatchLifecycleSession[],
): Promise<void> {
  for (const session of sessions) {
    if (!session.boardMessageId || !session.boardChannelId) {
      await refreshScoreboardFromSession(client, settings, session);
      continue;
    }

    const channel = await fetchTextChannel(client, session.boardChannelId);
    const message = await channel?.messages.fetch(session.boardMessageId).catch(() => null);
    if (!message) {
      await refreshScoreboardFromSession(client, settings, session);
    }
  }
}
