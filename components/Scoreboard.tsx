import { PLAYER_KEYS, PLAYERS, formatINR, type Player } from "@/lib/constants";
import { planTarget, type Plan } from "@/lib/plan";
import { leaderOf, type PlayerStats } from "@/lib/stats";

const bar: Record<Player, string> = {
  husband: "bg-sky-500",
  wife: "bg-pink-500",
};
const ring: Record<Player, string> = {
  husband: "ring-sky-500/40",
  wife: "ring-pink-500/40",
};

function pct(n: number, of: number) {
  return Math.min(100, (n / of) * 100);
}

export default function Scoreboard({
  stats,
  me,
  plan,
}: {
  stats: Record<Player, PlayerStats>;
  me: Player;
  plan: Plan;
}) {
  const INDIVIDUAL_TARGET = planTarget(plan);
  const COMBINED_TARGET = INDIVIDUAL_TARGET * 2;
  const combined = stats.husband.total + stats.wife.total;
  const combinedPct = pct(combined, COMBINED_TARGET);
  const leader = leaderOf(stats);

  return (
    <section className="space-y-3">
      <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5 dark:bg-zinc-900 dark:ring-white/10">
        <div className="flex items-baseline justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Household</span>
          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            {combinedPct.toFixed(1)}%
          </span>
        </div>
        <div className="mt-1 text-2xl font-extrabold tabular-nums">
          {formatINR(combined)}
          <span className="text-base font-semibold text-zinc-400"> / {formatINR(COMBINED_TARGET)}</span>
        </div>
        <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
          {PLAYER_KEYS.map((p) => (
            <div
              key={p}
              className={`${bar[p]} h-full transition-[width] duration-500`}
              style={{ width: `${pct(stats[p].total, COMBINED_TARGET)}%` }}
            />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {PLAYER_KEYS.map((p) => {
          const s = stats[p];
          const isLeader = leader === p;
          return (
            <div
              key={p}
              className={`relative rounded-2xl bg-white p-3.5 shadow-sm ring-1 dark:bg-zinc-900 ${
                p === me ? `ring-2 ${ring[p]}` : "ring-black/5 dark:ring-white/10"
              }`}
            >
              <div className="flex flex-col items-start gap-1">
                <span className="max-w-full truncate text-sm font-bold">
                  {PLAYERS[p].emoji} {PLAYERS[p].name}
                </span>
                {isLeader && (
                  <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
                    👑 Leader
                  </span>
                )}
                {!leader && (
                  <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-bold text-zinc-500 dark:bg-zinc-800">
                    Tied
                  </span>
                )}
              </div>
              <div className="mt-2 text-[11px] uppercase tracking-wide text-zinc-500">Total saved</div>
              <div className="text-xl font-extrabold tabular-nums">{formatINR(s.total)}</div>
              <div className="mt-1 text-[11px] uppercase tracking-wide text-zinc-500">Boxes</div>
              <div className="text-sm font-semibold tabular-nums">
                {s.count} / {plan.count}
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                <div
                  className={`${bar[p]} h-full transition-[width] duration-500`}
                  style={{ width: `${pct(s.total, INDIVIDUAL_TARGET)}%` }}
                />
              </div>
              <div className="mt-1 text-[10px] text-zinc-500 tabular-nums">
                {pct(s.total, INDIVIDUAL_TARGET).toFixed(0)}% of {formatINR(INDIVIDUAL_TARGET)}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
