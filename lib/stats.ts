import { PLAYERS, SUNDAYS, TIME_ZONE, type Player } from "./constants";
import type { BoxRow } from "./types";

export type PlayerStats = {
  total: number;
  count: number;
  lastActive: string | null;
};

export function computeStats(boxes: BoxRow[]): Record<Player, PlayerStats> {
  const out = {
    husband: { total: 0, count: 0, lastActive: null },
    wife: { total: 0, count: 0, lastActive: null },
  } as Record<Player, PlayerStats>;
  for (const b of boxes) {
    if (!b.isChecked) continue;
    const s = out[b.player];
    s.total += b.amount;
    s.count += 1;
    if (b.checkedAt && (!s.lastActive || b.checkedAt > s.lastActive)) s.lastActive = b.checkedAt;
  }
  return out;
}

export function leaderOf(stats: Record<Player, PlayerStats>): Player | null {
  if (stats.husband.total === stats.wife.total) return null;
  return stats.husband.total > stats.wife.total ? "husband" : "wife";
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
  payer: Player | null;
  reason: string;
  windowCounts: Record<Player, number>;
};

/**
 * Who pays for chai on a given Sunday?
 * 1. Fewer ticks during that week (since the previous Sunday) pays.
 * 2. If that's tied (e.g. nobody ticked anything), fewer total ticks pays.
 * 3. Still tied → split it.
 */
export function chaiVerdict(boxes: BoxRow[], weekIndex: number): ChaiVerdict {
  const idx = SUNDAYS.findIndex((d) => d.weekIndex === weekIndex);
  const end = endOfDayIST(SUNDAYS[idx].iso);
  const start = idx > 0 ? endOfDayIST(SUNDAYS[idx - 1].iso) : -Infinity;

  const windowCounts = { husband: 0, wife: 0 } as Record<Player, number>;
  const totals = { husband: 0, wife: 0 } as Record<Player, number>;
  for (const b of boxes) {
    if (!b.isChecked) continue;
    totals[b.player] += 1;
    if (b.checkedAt) {
      const t = new Date(b.checkedAt).getTime();
      if (t > start && t <= end) windowCounts[b.player] += 1;
    }
  }

  const fewer = (c: Record<Player, number>): Player | null =>
    c.husband === c.wife ? null : c.husband < c.wife ? "husband" : "wife";

  const byWindow = fewer(windowCounts);
  if (byWindow) {
    return {
      payer: byWindow,
      reason: `Fewer ticks ${idx === 0 ? "before this Sunday" : "this week"} (${windowCounts[byWindow]} vs ${windowCounts[PLAYERS[byWindow].partner]})`,
      windowCounts,
    };
  }
  const byTotal = fewer(totals);
  if (byTotal) {
    return {
      payer: byTotal,
      reason: `Fewer total ticks (${totals[byTotal]} vs ${totals[PLAYERS[byTotal].partner]})`,
      windowCounts,
    };
  }
  return { payer: null, reason: "Dead heat — split the bill 🤝", windowCounts };
}
