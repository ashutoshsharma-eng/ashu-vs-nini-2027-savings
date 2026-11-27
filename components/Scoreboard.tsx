import { formatINR } from "@/lib/constants";
import { colorOf } from "@/lib/members";
import { planTarget, type Plan } from "@/lib/plan";
import { groupTotal, leaderOf, ranking, type StatsById } from "@/lib/stats";
import type { Member } from "@/lib/types";

const pct = (n: number, of: number) => (of > 0 ? Math.min(100, (n / of) * 100) : 0);
const card = "rounded-2xl bg-white shadow-sm ring-1 ring-black/5 dark:bg-zinc-900 dark:ring-white/10";

export default function Scoreboard({
  stats,
  me,
  members,
  plan,
}: {
  stats: StatsById;
  me: Member;
  members: Member[];
  plan: Plan;
}) {
  const each = planTarget(plan);
  const goal = each * members.length;
  const total = groupTotal(stats, members);

  // --- Solo: one big personal card -------------------------------------------------
  if (members.length === 1) {
    const s = stats[me.id];
    return (
      <section className={`${card} p-5`}>
        <div className="flex items-baseline justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">My savings</span>
          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            {pct(s.total, each).toFixed(1)}%
          </span>
        </div>
        <div className="mt-1 text-3xl font-extrabold tabular-nums">
          {formatINR(s.total)}
          <span className="text-base font-semibold text-zinc-400"> / {formatINR(each)}</span>
        </div>
        <div className="mt-3 h-3 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
          <div
            className={`${colorOf(me.color).bar} h-full transition-[width] duration-500`}
            style={{ width: `${pct(s.total, each)}%` }}
          />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-[11px] uppercase tracking-wide text-zinc-500">Boxes done</div>
            <div className="font-bold tabular-nums">
              {s.count} / {plan.count}
            </div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide text-zinc-500">Still to go</div>
            <div className="font-bold tabular-nums">{formatINR(Math.max(0, each - s.total))}</div>
          </div>
        </div>
      </section>
    );
  }

  const leader = leaderOf(stats, members);

  // --- Group goal bar (shared by duo and group) -------------------------------------
  const goalBar = (
    <div className={`${card} p-4`}>
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          {members.length === 2 ? "Household" : "Family goal"}
        </span>
        <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
          {pct(total, goal).toFixed(1)}%
        </span>
      </div>
      <div className="mt-1 text-2xl font-extrabold tabular-nums">
        {formatINR(total)}
        <span className="text-base font-semibold text-zinc-400"> / {formatINR(goal)}</span>
      </div>
      <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
        {members.map((m) => (
          <div
            key={m.id}
            className={`${colorOf(m.color).bar} h-full transition-[width] duration-500`}
            style={{ width: `${pct(stats[m.id]?.total ?? 0, goal)}%` }}
            title={m.name}
          />
        ))}
      </div>
    </div>
  );

  // --- Duo: side-by-side cards ------------------------------------------------------
  if (members.length === 2) {
    return (
      <section className="space-y-3">
        {goalBar}
        <div className="grid grid-cols-2 gap-3">
          {members.map((m) => {
            const s = stats[m.id];
            return (
              <div
                key={m.id}
                className={`relative rounded-2xl bg-white p-3.5 shadow-sm ring-1 dark:bg-zinc-900 ${
                  m.id === me.id ? `ring-2 ${colorOf(m.color).ring}` : "ring-black/5 dark:ring-white/10"
                }`}
              >
                <div className="flex flex-col items-start gap-1">
                  <span className="max-w-full truncate text-sm font-bold">
                    {m.emoji} {m.name}
                  </span>
                  <Badge isLeader={leader?.id === m.id} tied={!leader} />
                </div>
                <div className="mt-2 text-[11px] uppercase tracking-wide text-zinc-500">Total saved</div>
                <div className="text-xl font-extrabold tabular-nums">{formatINR(s.total)}</div>
                <div className="mt-1 text-[11px] uppercase tracking-wide text-zinc-500">Boxes</div>
                <div className="text-sm font-semibold tabular-nums">
                  {s.count} / {plan.count}
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                  <div
                    className={`${colorOf(m.color).bar} h-full transition-[width] duration-500`}
                    style={{ width: `${pct(s.total, each)}%` }}
                  />
                </div>
                <div className="mt-1 text-[10px] tabular-nums text-zinc-500">
                  {pct(s.total, each).toFixed(0)}% of {formatINR(each)}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    );
  }

  // --- Group (3+): ranked leaderboard ----------------------------------------------
  return (
    <section className="space-y-3">
      {goalBar}
      <ol className={`${card} divide-y divide-black/5 dark:divide-white/10`} aria-label="Leaderboard">
        {ranking(stats, members).map((m, i) => {
          const s = stats[m.id];
          const isLeader = leader?.id === m.id;
          return (
            <li
              key={m.id}
              className={`flex items-center gap-3 px-4 py-3 ${m.id === me.id ? "bg-zinc-50 dark:bg-zinc-800/50" : ""}`}
            >
              <span className="w-5 text-center text-sm font-bold tabular-nums text-zinc-400">
                {isLeader ? "👑" : i + 1}
              </span>
              <span className="text-2xl">{m.emoji}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-bold">{m.name}</span>
                  {m.id === me.id && <span className="text-[10px] font-semibold text-zinc-500">YOU</span>}
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                  <div
                    className={`${colorOf(m.color).bar} h-full transition-[width] duration-500`}
                    style={{ width: `${pct(s.total, each)}%` }}
                  />
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-extrabold tabular-nums">{formatINR(s.total)}</div>
                <div className="text-[10px] tabular-nums text-zinc-500">
                  {s.count}/{plan.count} boxes
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function Badge({ isLeader, tied }: { isLeader: boolean; tied: boolean }) {
  if (isLeader)
    return (
      <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
        👑 Leader
      </span>
    );
  if (tied)
    return (
      <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-bold text-zinc-500 dark:bg-zinc-800">
        Tied
      </span>
    );
  return null;
}
