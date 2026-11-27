import { SUNDAYS, TIME_ZONE } from "./constants";
import type { BoxRow, Member } from "./types";

export type PlayerStats = {
  total: number;
  count: number;
  lastActive: string | null;
};

export type StatsById = Record<number, PlayerStats>;

const empty = (): PlayerStats => ({ total: 0, count: 0, lastActive: null });

export function computeStats(boxes: BoxRow[], members: Member[]): StatsById {
  const out: StatsById = {};
  for (const m of members) out[m.id] = empty();
  for (const b of boxes) {
    if (!b.isChecked) continue;
    const s = (out[b.memberId] ??= empty());
    s.total += b.amount;
    s.count += 1;
    if (b.checkedAt && (!s.lastActive || b.checkedAt > s.lastActive)) s.lastActive = b.checkedAt;
  }
  return out;
}

export function groupTotal(stats: StatsById, members: Member[]): number {
  return members.reduce((a, m) => a + (stats[m.id]?.total ?? 0), 0);
}

/** Members sorted by total saved (desc), then boxes, then name. */
export function ranking(stats: StatsById, members: Member[]): Member[] {
  return [...members].sort(
    (a, b) =>
      (stats[b.id]?.total ?? 0) - (stats[a.id]?.total ?? 0) ||
      (stats[b.id]?.count ?? 0) - (stats[a.id]?.count ?? 0) ||
      a.name.localeCompare(b.name),
  );
}

/** The single member with the highest total, or null if nobody has saved yet / it's tied at the top. */
export function leaderOf(stats: StatsById, members: Member[]): Member | null {
  if (members.length < 2) return null;
  const [first, second] = ranking(stats, members);
  const top = stats[first.id]?.total ?? 0;
  if (top === 0 || top === (stats[second.id]?.total ?? 0)) return null;
  return first;
}

export function formatDate(iso: string | null, withTime = false): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    timeZone: TIME_ZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}),
  });
}

export function daysAgo(iso: string | null, now = Date.now()): string {
  if (!iso) return "No ticks yet";
  const days = Math.floor((now - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "Active today";
  if (days === 1) return "Yesterday";
  return `${days} days ago`;
}

/** End of the given ISO date (YYYY-MM-DD) in IST, as epoch ms. */
export function endOfDayIST(iso: string): number {
  return new Date(`${iso}T23:59:59.999+05:30`).getTime();
}

export type ChaiVerdict = {
  /** member who pays, or null for "split it" (and always null when saving solo) */
  payer: Member | null;
  reason: string;
};

/** Of the candidates, those with the smallest value. */
function fewest(cands: Member[], value: (m: Member) => number): Member[] {
  const min = Math.min(...cands.map(value));
  return cands.filter((m) => value(m) === min);
}

/**
 * Who pays for chai on a given Sunday?
 * 1. Whoever ticked the fewest boxes that week (since the previous Sunday) pays.
 * 2. If several tie, the one among them with the fewest total ticks pays.
 * 3. Still tied → split it.
 */
export function chaiVerdict(boxes: BoxRow[], members: Member[], weekIndex: number): ChaiVerdict {
  if (members.length < 2) return { payer: null, reason: "Solo check-in — treat yourself if you ticked a box ☕" };

  const idx = SUNDAYS.findIndex((d) => d.weekIndex === weekIndex);
  const end = endOfDayIST(SUNDAYS[idx].iso);
  const start = idx > 0 ? endOfDayIST(SUNDAYS[idx - 1].iso) : -Infinity;

  const week: Record<number, number> = {};
  const total: Record<number, number> = {};
  for (const m of members) week[m.id] = total[m.id] = 0;
  for (const b of boxes) {
    if (!b.isChecked || !(b.memberId in total)) continue;
    total[b.memberId] += 1;
    if (b.checkedAt) {
      const t = new Date(b.checkedAt).getTime();
      if (t > start && t <= end) week[b.memberId] += 1;
    }
  }

  const byWeek = fewest(members, (m) => week[m.id]);
  if (byWeek.length === 1) {
    const p = byWeek[0];
    const others = Math.max(...members.filter((m) => m.id !== p.id).map((m) => week[m.id]));
    return {
      payer: p,
      reason: `Fewest ticks ${idx === 0 ? "before this Sunday" : "this week"} (${week[p.id]} vs ${others})`,
    };
  }
  const byTotal = fewest(byWeek, (m) => total[m.id]);
  if (byTotal.length === 1) {
    const p = byTotal[0];
    return { payer: p, reason: `Tied this week — fewest total ticks (${total[p.id]})` };
  }
  return { payer: null, reason: "Dead heat — split the bill 🤝" };
}

/** The friendly wager line, worded for the group size. */
export function stakesLine(memberCount: number): string {
  if (memberCount <= 1) return "Don't break the chain — one box at a time gets you there 🔗";
  if (memberCount === 2) return "Whoever quits first sponsors the other's 2028 trip ✈️";
  return "Whoever quits first treats everyone on the 2028 trip ✈️";
}
