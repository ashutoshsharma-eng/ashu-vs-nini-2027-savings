export type Player = "husband" | "wife";

export const PLAYER_KEYS: Player[] = ["husband", "wife"];

export const PLAYERS: Record<
  Player,
  { name: string; role: string; emoji: string; partner: Player }
> = {
  husband: { name: "Ashutosh", role: "Husband", emoji: "🧔🏻", partner: "wife" },
  wife: { name: "Niharika", role: "Wife", emoji: "👩🏻", partner: "husband" },
};

export const BOX_STEP = 50;
export const BOX_COUNT = 52;
/** ₹50, ₹100, … ₹2,600 */
export const AMOUNTS = Array.from({ length: BOX_COUNT }, (_, i) => (i + 1) * BOX_STEP);

export const INDIVIDUAL_TARGET = AMOUNTS.reduce((a, b) => a + b, 0); // 68,900
export const COMBINED_TARGET = INDIVIDUAL_TARGET * 2; // 1,37,800
export const MILESTONE_STEP = 10_000;

/** Every Sunday of 2027 is a "Money Date": Jan 3 → Dec 26 (52 Sundays). */
export const SUNDAYS: { weekIndex: number; iso: string }[] = Array.from({ length: 52 }, (_, i) => {
  const d = new Date(Date.UTC(2027, 0, 3 + i * 7));
  return { weekIndex: i + 1, iso: d.toISOString().slice(0, 10) };
});

/** Auto-logout after this much inactivity. */
export const IDLE_LIMIT_MS = 5 * 60 * 1000;

export const TIME_ZONE = "Asia/Kolkata";

export function formatINR(n: number): string {
  return "₹" + n.toLocaleString("en-IN");
}

export function isPlayer(v: unknown): v is Player {
  return v === "husband" || v === "wife";
}

/** "2027-01-03" → "Sun, 3 Jan" */
export function formatSunday(iso: string, withYear = false): string {
  return new Date(`${iso}T12:00:00+05:30`).toLocaleDateString("en-IN", {
    timeZone: TIME_ZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
    ...(withYear ? { year: "numeric" } : {}),
  });
}

export function monthOf(iso: string): string {
  return new Date(`${iso}T12:00:00+05:30`).toLocaleDateString("en-IN", {
    timeZone: TIME_ZONE,
    month: "long",
    year: "numeric",
  });
}
