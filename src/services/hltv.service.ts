import HLTV from "hltv";

export type HltvEvent = Awaited<ReturnType<typeof HLTV.getEvents>>[number];
export type HltvMatch = Awaited<ReturnType<typeof HLTV.getMatches>>[number];

export async function fetchEvents(): Promise<HltvEvent[]> {
  return HLTV.getEvents();
}

export async function fetchMatches(): Promise<HltvMatch[]> {
  return HLTV.getMatches();
}

export function eventUrl(event: HltvEvent): string {
  const slug = slugify(event.name);
  return `https://www.hltv.org/events/${event.id}/${slug}`;
}

export function matchUrl(match: HltvMatch): string {
  const team1 = match.team1?.name ?? "team1";
  const team2 = match.team2?.name ?? "team2";
  const slug = slugify(`${team1}-vs-${team2}`);
  return `https://www.hltv.org/matches/${match.id}/${slug}`;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function formatTimestamp(unixSeconds?: number): string {
  if (!unixSeconds) return "TBA";
  return `<t:${unixSeconds}:F> (<t:${unixSeconds}:R>)`;
}

export function formatDateRange(start?: number, end?: number): string {
  if (!start) return "TBA";
  if (!end || end === start) return formatTimestamp(start);
  return `${formatTimestamp(start)} – ${formatTimestamp(end)}`;
}

export function matchLabel(match: HltvMatch): string {
  if (match.title) return match.title;
  const t1 = match.team1?.name ?? "TBD";
  const t2 = match.team2?.name ?? "TBD";
  return `${t1} vs ${t2}`;
}

export function starsDisplay(stars: number): string {
  return "★".repeat(stars) + "☆".repeat(Math.max(0, 5 - stars));
}
