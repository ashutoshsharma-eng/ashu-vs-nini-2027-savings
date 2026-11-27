export type Player = "husband" | "wife";

export const PLAYER_KEYS: Player[] = ["husband", "wife"];

export const PLAYERS: Record<
  Player,
  { name: string; role: string; emoji: string; partner: Player }
> = {
  husband: { name: "Ashutosh", role: "Husband", emoji: "🧔🏻", partner: "wife" },
  wife: { name: "Niharika", role: "Wife", emoji: "👩🏻", partner: "husband" },
};

/** Confetti party every time the two of you cross another ₹10,000 together. */
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
