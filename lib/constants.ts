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

/** First Sundays of 2027 — the monthly "Money Date". */
export const MONEY_DATES = [
  { monthIndex: 1, monthLabel: "January", sundayDate: "Jan 3, 2027", iso: "2027-01-03" },
  { monthIndex: 2, monthLabel: "February", sundayDate: "Feb 7, 2027", iso: "2027-02-07" },
  { monthIndex: 3, monthLabel: "March", sundayDate: "Mar 7, 2027", iso: "2027-03-07" },
  { monthIndex: 4, monthLabel: "April", sundayDate: "Apr 4, 2027", iso: "2027-04-04" },
  { monthIndex: 5, monthLabel: "May", sundayDate: "May 2, 2027", iso: "2027-05-02" },
  { monthIndex: 6, monthLabel: "June", sundayDate: "Jun 6, 2027", iso: "2027-06-06" },
  { monthIndex: 7, monthLabel: "July", sundayDate: "Jul 4, 2027", iso: "2027-07-04" },
  { monthIndex: 8, monthLabel: "August", sundayDate: "Aug 1, 2027", iso: "2027-08-01" },
  { monthIndex: 9, monthLabel: "September", sundayDate: "Sep 5, 2027", iso: "2027-09-05" },
  { monthIndex: 10, monthLabel: "October", sundayDate: "Oct 3, 2027", iso: "2027-10-03" },
  { monthIndex: 11, monthLabel: "November", sundayDate: "Nov 7, 2027", iso: "2027-11-07" },
  { monthIndex: 12, monthLabel: "December", sundayDate: "Dec 5, 2027", iso: "2027-12-05" },
] as const;

export const TIME_ZONE = "Asia/Kolkata";

export function formatINR(n: number): string {
  return "₹" + n.toLocaleString("en-IN");
}

export function isPlayer(v: unknown): v is Player {
  return v === "husband" || v === "wife";
}
