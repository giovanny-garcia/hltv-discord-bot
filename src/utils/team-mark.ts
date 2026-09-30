export interface TeamBadge {
  mark: string;
  label: string;
}

interface KnownTeam {
  mark: string;
  label: string;
  keys: string[];
}

const KNOWN_TEAMS: KnownTeam[] = [
  { mark: "🟡", label: "NAVI", keys: ["navi", "natus vincere"] },
  { mark: "🔴", label: "FaZe", keys: ["faze"] },
  { mark: "⚫", label: "G2", keys: ["g2"] },
  { mark: "🐝", label: "Vitality", keys: ["vitality"] },
  { mark: "💙", label: "Spirit", keys: ["spirit"] },
  { mark: "🐭", label: "MOUZ", keys: ["mouz", "mousesports"] },
  { mark: "⭐", label: "Astralis", keys: ["astralis"] },
  { mark: "🛡️", label: "Heroic", keys: ["heroic"] },
  { mark: "💧", label: "Liquid", keys: ["liquid"] },
  { mark: "☁️", label: "Cloud9", keys: ["cloud9", "c9"] },
  { mark: "🐆", label: "FURIA", keys: ["furia"] },
  { mark: "💚", label: "paiN", keys: ["pain"] },
  { mark: "🟠", label: "COL", keys: ["complexity", "col"] },
  { mark: "⬛", label: "BIG", keys: ["big"] },
  { mark: "🔶", label: "ENCE", keys: ["ence"] },
  { mark: "🐻", label: "VP", keys: ["virtus pro", "vp"] },
  { mark: "🥷", label: "NiP", keys: ["ninjas in pyjamas", "nip"] },
  { mark: "🦊", label: "Fnatic", keys: ["fnatic"] },
  { mark: "🟢", label: "OG", keys: ["og"] },
  { mark: "💜", label: "9z", keys: ["9z"] },
  { mark: "👑", label: "Imperial", keys: ["imperial"] },
  { mark: "🐺", label: "MongolZ", keys: ["mongolz", "the mongolz"] },
  { mark: "🌌", label: "Aurora", keys: ["aurora"] },
  { mark: "🦅", label: "Falcons", keys: ["falcons"] },
  { mark: "🪚", label: "SAW", keys: ["saw"] },
  { mark: "🔺", label: "3DMAX", keys: ["3dmax"] },
  { mark: "🎖️", label: "GL", keys: ["gamerlegion", "gamer legion"] },
  { mark: "💚", label: "MIBR", keys: ["mibr"] },
  { mark: "💥", label: "BetBoom", keys: ["betboom"] },
  { mark: "🔷", label: "PARI", keys: ["parivision"] },
  { mark: "✈️", label: "FlyQuest", keys: ["flyquest"] },
  { mark: "🃏", label: "Wildcard", keys: ["wildcard"] },
  { mark: "💛", label: "Passion", keys: ["passion ua"] },
  { mark: "🔥", label: "EF", keys: ["eternal fire"] },
  { mark: "🏛️", label: "Legacy", keys: ["legacy"] },
  { mark: "💣", label: "M80", keys: ["m80"] },
  { mark: "⛰️", label: "Monte", keys: ["monte"] },
  { mark: "⚡", label: "ECSTATIC", keys: ["ecstatic"] },
  { mark: "🔭", label: "Lynn", keys: ["lynn vision"] },
  { mark: "🐉", label: "TYLOO", keys: ["tyloo"] },
  { mark: "⚛️", label: "Rare Atom", keys: ["rare atom"] },
  { mark: "🏹", label: "Huns", keys: ["huns", "the huns"] },
  { mark: "🟣", label: "Nemiga", keys: ["nemiga"] },
  { mark: "8️⃣", label: "B8", keys: ["b8"] },
  { mark: "⚓", label: "Metizport", keys: ["metizport"] },
];

const BY_KEY = new Map<string, TeamBadge>();
for (const team of KNOWN_TEAMS) {
  for (const key of team.keys) {
    BY_KEY.set(key, { mark: team.mark, label: team.label });
  }
}

function normalizeTeamName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(team|esports|gaming|club|clan)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function initials(name: string): string {
  const parts = name
    .replace(/[^A-Za-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((word) => !/^(team|esports|gaming|club|clan)$/i.test(word));
  const source = parts.length > 0 ? parts : ["?"];
  const letters =
    source.length >= 2
      ? `${source[0]?.[0] ?? ""}${source[source.length - 1]?.[0] ?? ""}`
      : (source[0] ?? "?").slice(0, 2);
  return letters.toUpperCase().padEnd(2, "·").slice(0, 2);
}

function lookupKnownTeam(name: string): TeamBadge | undefined {
  const key = normalizeTeamName(name);
  const exact = BY_KEY.get(key);
  if (exact) return exact;
  for (const [known, badge] of BY_KEY) {
    if (key.startsWith(`${known} `)) return badge;
  }
  return undefined;
}

/** A short mark plus a compact name. Known teams get a symbol; everyone else gets initials. */
export function teamBadge(name: string): TeamBadge {
  return lookupKnownTeam(name) ?? { mark: initials(name), label: name };
}
