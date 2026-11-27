import { daysAgo, formatDate, stakesLine, type StatsById } from "@/lib/stats";
import type { Member } from "@/lib/types";

export default function StakesBanner({
  stats,
  members,
  now,
}: {
  stats: StatsById;
  members: Member[];
  now: number;
}) {
  const many = members.length > 2;
  return (
    <section className="rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-600 p-4 text-white shadow-md">
      <p className="text-sm font-bold leading-snug">{stakesLine(members.length)}</p>
      <div
        className={
          many
            ? "-mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1"
            : `mt-3 grid gap-2 ${members.length === 2 ? "grid-cols-2" : "grid-cols-1"}`
        }
      >
        {members.map((m) => (
          <div key={m.id} className={`rounded-xl bg-white/15 px-3 py-2 ${many ? "w-36 shrink-0" : ""}`}>
            <div className="truncate text-xs font-semibold">
              {m.emoji} {m.name}
            </div>
            <div className="text-[11px] text-white/80">Last active</div>
            <div className="text-sm font-semibold">{formatDate(stats[m.id]?.lastActive ?? null)}</div>
            <div className="text-[11px] text-white/80">{daysAgo(stats[m.id]?.lastActive ?? null, now)}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
