import { PLAYER_KEYS, PLAYERS, type Player } from "@/lib/constants";
import { daysAgo, formatDate, type PlayerStats } from "@/lib/stats";

export default function StakesBanner({
  stats,
  now,
}: {
  stats: Record<Player, PlayerStats>;
  now: number;
}) {
  return (
    <section className="rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-600 p-4 text-white shadow-md">
      <p className="text-sm font-bold leading-snug">
        Whoever quits first sponsors the other&apos;s 2028 trip ✈️
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {PLAYER_KEYS.map((p) => (
          <div key={p} className="rounded-xl bg-white/15 px-3 py-2">
            <div className="text-xs font-semibold">
              {PLAYERS[p].emoji} {PLAYERS[p].name}
            </div>
            <div className="text-[11px] text-white/80">Last active</div>
            <div className="text-sm font-semibold">{formatDate(stats[p].lastActive)}</div>
            <div className="text-[11px] text-white/80">{daysAgo(stats[p].lastActive, now)}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
