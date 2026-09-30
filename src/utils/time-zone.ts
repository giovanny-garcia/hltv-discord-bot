const POPULAR_TIME_ZONES = [
  "America/Chicago",
  "America/New_York",
  "America/Denver",
  "America/Los_Angeles",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Paris",
  "Europe/Stockholm",
  "UTC",
];

export function isValidTimeZone(timeZone: string): boolean {
  try {
    Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

export function listTimeZones(query: string): string[] {
  const zones = Intl.supportedValuesOf("timeZone");
  const needle = query.trim().toLowerCase().replace(/\s+/g, "_");
  if (!needle) return POPULAR_TIME_ZONES;

  return zones
    .filter((zone) => zone.toLowerCase().includes(needle))
    .slice(0, 25);
}

export function hourInTimeZone(date: Date, timeZone: string): number {
  const hour = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    hourCycle: "h23",
  })
    .formatToParts(date)
    .find((part) => part.type === "hour")?.value;
  return Number(hour ?? 0);
}

export function calendarDay(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function isSameLocalDay(a: Date, b: Date, timeZone: string): boolean {
  return calendarDay(a, timeZone) === calendarDay(b, timeZone);
}

export function formatInTimeZone(unixSeconds: number, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(unixSeconds * 1000));
}
