"use client";

import { useMemo, useState } from "react";
import { BOX_COUNT, PLAYER_KEYS, PLAYERS, formatINR, type Player } from "@/lib/constants";
import { formatDate } from "@/lib/stats";
import type { BoxRow } from "@/lib/types";

type Filter = "all" | "remaining" | "completed";

const checkedStyle: Record<Player, string> = {
  husband: "bg-sky-500 text-white ring-sky-600 dark:bg-sky-600",
  wife: "bg-pink-500 text-white ring-pink-600 dark:bg-pink-600",
};
const tabStyle: Record<Player, string> = {
  husband: "bg-sky-500 text-white",
  wife: "bg-pink-500 text-white",
};

type Props = {
  me: Player;
  viewing: Player;
  onViewingChange: (p: Player) => void;
  boxes: BoxRow[];
  onBoxPress: (b: BoxRow) => void;
};

export default function BoxGrid({ me, viewing, onViewingChange, boxes, onBoxPress }: Props) {
  const [filter, setFilter] = useState<Filter>("all");
  const [asc, setAsc] = useState(true);
  const readOnly = viewing !== me;

  const playerBoxes = useMemo(() => boxes.filter((b) => b.player === viewing), [boxes, viewing]);
  const done = playerBoxes.filter((b) => b.isChecked).length;

  const visible = useMemo(() => {
    const list = playerBoxes.filter((b) =>
      filter === "all" ? true : filter === "completed" ? b.isChecked : !b.isChecked,
    );
    return list.sort((a, b) => (asc ? a.amount - b.amount : b.amount - a.amount));
  }, [playerBoxes, filter, asc]);

  const orderedPlayers = [me, ...PLAYER_KEYS.filter((p) => p !== me)];

  const filters: [Filter, string][] = [
    ["all", `All (${BOX_COUNT})`],
    ["remaining", `Remaining (${BOX_COUNT - done})`],
    ["completed", `Completed (${done})`],
  ];

  return (
    <section className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {orderedPlayers.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onViewingChange(p)}
            className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
              viewing === p ? tabStyle[p] : "bg-white ring-1 ring-black/10 dark:bg-zinc-900 dark:ring-white/10"
            }`}
          >
            {p === me ? "My boxes" : `${PLAYERS[p].name}'s`} {p !== me && "🔒"}
          </button>
        ))}
      </div>

      {readOnly && (
        <div className="flex items-center gap-2 rounded-xl bg-zinc-100 px-3 py-2 text-xs text-zinc-600 dark:bg-zinc-800/70 dark:text-zinc-300">
          <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-[10px] font-bold text-white dark:bg-white dark:text-zinc-900">
            🔒 READ-ONLY
          </span>
          You can cheer, but you can&apos;t fill your partner&apos;s boxes.
        </div>
      )}

      <div className="space-y-2">
        <div className="grid grid-cols-3 gap-1">
          {filters.map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`whitespace-nowrap rounded-full px-2 py-1.5 text-xs font-semibold transition ${
                filter === key
                  ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                  : "bg-white ring-1 ring-black/10 dark:bg-zinc-900 dark:ring-white/10"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setAsc((v) => !v)}
          className="w-full whitespace-nowrap rounded-full bg-white px-3 py-1.5 text-xs font-semibold ring-1 ring-black/10 dark:bg-zinc-900 dark:ring-white/10"
        >
          Sort: {asc ? "₹50 → ₹2,600" : "₹2,600 → ₹50"} ⇅
        </button>
      </div>

      {visible.length === 0 ? (
        <p className="rounded-2xl bg-white p-8 text-center text-sm text-zinc-500 ring-1 ring-black/5 dark:bg-zinc-900 dark:ring-white/10">
          {filter === "completed" ? "Nothing ticked yet — first box is the hardest! 💪" : "All 52 done. Legend. 🏆"}
        </p>
      ) : (
        <ul className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8">
          {visible.map((b) => (
            <li key={b.id}>
              <button
                type="button"
                onClick={() => onBoxPress(b)}
                aria-pressed={b.isChecked}
                aria-label={`${formatINR(b.amount)} ${b.isChecked ? "ticked" : "not ticked"}${readOnly ? " (read-only)" : ""}`}
                className={`relative flex aspect-square w-full flex-col items-center justify-center rounded-xl text-center ring-1 transition select-none ${
                  b.isChecked
                    ? `${checkedStyle[b.player]} animate-pop shadow-sm`
                    : "bg-white ring-black/10 dark:bg-zinc-900 dark:ring-white/10"
                } ${readOnly ? "cursor-not-allowed opacity-80" : "active:scale-95"}`}
              >
                {b.isChecked && <span className="absolute right-1 top-0.5 text-[10px]">✓</span>}
                <span className="text-[13px] font-bold tabular-nums sm:text-sm">{formatINR(b.amount)}</span>
                {b.isChecked && b.checkedAt && (
                  <span className="mt-0.5 text-[9px] leading-none opacity-80">
                    {formatDate(b.checkedAt).replace(/ \d{4}$/, "")}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
