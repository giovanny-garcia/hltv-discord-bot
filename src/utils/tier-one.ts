const TIER_ONE_PATTERNS = [
  /\bmajor\b/i,
  /\bblast\b/i,
  /\besl pro league\b/i,
  /\bintel extreme masters\b/i,
  /\biem\b/i,
  /\besports world cup\b/i,
  /\bewc\b/i,
];

/** Short labels shown in Discord for what the default feed includes. */
export const TIER_ONE_LABELS = [
  "Majors (any event with “Major” in the name)",
  "BLAST",
  "ESL Pro League",
  "IEM / Intel Extreme Masters",
  "Esports World Cup / EWC",
];

export function isTierOneEvent(eventName?: string): boolean {
  if (!eventName) return false;
  return TIER_ONE_PATTERNS.some((pattern) => pattern.test(eventName));
}
