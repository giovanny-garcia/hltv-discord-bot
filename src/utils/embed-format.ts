/** Discord embeds can't change font size — use structure, bold, and spacing instead. */

export const RULE = "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━";
export const RULE_THIN = "──────────────────────────────";

export function sectionLabel(text: string): string {
  return `**${text.toUpperCase()}**`;
}

export function bigStat(value: string | number): string {
  return `# **${value}**`;
}

export function statLine(label: string, value: string): string {
  return `${sectionLabel(label)}\n**${value}**`;
}

export function vsBlock(subtitle?: string): string {
  return ["", "**⚔️ VS ⚔️**", subtitle ? `*${subtitle}*` : null, ""].filter(Boolean).join("\n");
}

/** Symmetrical two-team block — clean field-style layout without monospace padding. */
export function symmetricalMatchup(options: {
  leftBadge: string;
  leftName: string;
  leftSeries: string;
  leftSub?: string;
  rightBadge: string;
  rightName: string;
  rightSeries: string;
  rightSub?: string;
  centerLabel?: string;
}): string {
  const left = [
    `${options.leftBadge} **${options.leftName}**`,
    options.leftSeries,
    options.leftSub,
  ]
    .filter(Boolean)
    .join("\n");

  const right = [
    `${options.rightBadge} **${options.rightName}**`,
    options.rightSeries,
    options.rightSub,
  ]
    .filter(Boolean)
    .join("\n");

  const center = options.centerLabel ? `**${options.centerLabel}**` : "**vs**";

  return [left, "", center, "", right].join("\n");
}

export function listBlock(lines: string[]): string {
  return lines.map((line) => `▸ ${line}`).join("\n\n");
}

export function medalForRank(rank: number): string {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return `**#${rank}**`;
}

export function credits(amount: number): string {
  return `**${amount.toLocaleString()}** cr`;
}

export function pct(value: number): string {
  return `**${value.toFixed(1)}%**`;
}

export function deltaText(delta: number): string {
  const formatted = delta >= 0 ? `+${delta.toLocaleString()}` : delta.toLocaleString();
  return delta >= 0 ? `**${formatted}** 📈` : `**${formatted}** 📉`;
}
