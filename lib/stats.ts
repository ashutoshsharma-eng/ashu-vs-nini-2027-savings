import { BOX_COUNT, MONEY_DATES, PLAYER_KEYS, PLAYERS, TIME_ZONE, type Player } from "./constants";
import type { BoxRow, MoneyDateRow } from "./types";

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
function endOfDayIST(iso: string): number {
  return new Date(`${iso}T23:59:59.999+05:30`).getTime();
}

export type ChaiVerdict = {
  payer: Player | null;
  reason: string;
  windowCounts: Record<Player, number>;
};

/**
 * Who pays for chai at a Money Date?
 * 1. Fewer ticks since the previous Money Date (the "month" being reviewed) pays.
 * 2. If that's tied (or nobody ticked anything yet), fewer total ticks pays.
 * 3. Still tied → split it.
 */
export function chaiVerdict(boxes: BoxRow[], monthIndex: number): ChaiVerdict {
  const idx = MONEY_DATES.findIndex((d) => d.monthIndex === monthIndex);
  const end = endOfDayIST(MONEY_DATES[idx].iso);
  const start = idx > 0 ? endOfDayIST(MONEY_DATES[idx - 1].iso) : -Infinity;

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
      reason: `Fewer ticks ${idx === 0 ? "before this date" : "since the last Money Date"} (${windowCounts[byWindow]} vs ${windowCounts[PLAYERS[byWindow].partner]})`,
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

function csvCell(v: string | number): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function buildCsv(boxes: BoxRow[], dates: MoneyDateRow[]): string {
  const stats = computeStats(boxes);
  const lines: (string | number)[][] = [
    ["Husband vs Wife 2027 Savings — export", new Date().toISOString()],
    [],
    ["Summary"],
    ["Player", "Name", "Total Saved (INR)", "Boxes Completed", "Last Active"],
    ...PLAYER_KEYS.map((p) => [
      p,
      PLAYERS[p].name,
      stats[p].total,
      `${stats[p].count}/${BOX_COUNT}`,
      stats[p].lastActive ?? "",
    ]),
    ["Combined", "", stats.husband.total + stats.wife.total, "", ""],
    [],
    ["Boxes"],
    ["Player", "Name", "Amount (INR)", "Status", "Checked At (IST)"],
    ...boxes.map((b) => [
      b.player,
      PLAYERS[b.player].name,
      b.amount,
      b.isChecked ? "Completed" : "Remaining",
      b.isChecked ? formatDate(b.checkedAt, true) : "",
    ]),
    [],
    ["Money Dates"],
    ["Month", "Sunday", "Completed", "Chai paid by", "Notes"],
    ...dates.map((d) => {
      const v = chaiVerdict(boxes, d.monthIndex);
      return [
        d.monthLabel,
        d.sundayDate,
        d.isCompleted ? "Yes" : "No",
        v.payer ? PLAYERS[v.payer].name : "Split",
        d.notes,
      ];
    }),
  ];
  return lines.map((row) => row.map(csvCell).join(",")).join("\n");
}
