"use client";

import { useMemo, useState } from "react";
import { formatINR } from "@/lib/constants";
import { colorOf } from "@/lib/members";
import { lastBox, type Plan } from "@/lib/plan";
import { formatDate } from "@/lib/stats";
import type { BoxRow, Member } from "@/lib/types";
import MemberPicker from "./MemberPicker";

type Filter = "all" | "remaining" | "completed";

type Props = {
  me: Member;
  members: Member[];
  viewing: number;
  onViewingChange: (id: number) => void;
  boxes: BoxRow[];
  onBoxPress: (b: BoxRow) => void;
  plan: Plan;
};

export default function BoxGrid({ me, members, viewing, onViewingChange, boxes, onBoxPress, plan }: Props) {
  const BOX_COUNT = plan.count;
  const [filter, setFilter] = useState<Filter>("all");
  const [asc, setAsc] = useState(true);
  const readOnly = viewing !== me.id;
  const owner = members.find((m) => m.id === viewing) ?? me;
  const checkedStyle = colorOf(owner.color).checked;

  const playerBoxes = useMemo(() => boxes.filter((b) => b.memberId === viewing), [boxes, viewing]);
  const done = playerBoxes.filter((b) => b.isChecked).length;

  const visible = useMemo(() => {
    const list = playerBoxes.filter((b) =>
      filter === "all" ? true : filter === "completed" ? b.isChecked : !b.isChecked,
    );
    return list.sort((a, b) => (asc ? a.amount - b.amount : b.amount - a.amount));
  }, [playerBoxes, filter, asc]);

  const filters: [Filter, string][] = [
    ["all", `All (${BOX_COUNT})`],
    ["remaining", `Remaining (${BOX_COUNT - done})`],
    ["completed", `Completed (${done})`],
  ];

  return (
    <section className="space-y-3">
      <MemberPicker me={me} members={members} viewing={viewing} onChange={onViewingChange} mineLabel="My boxes" />

      {readOnly && (
        <div className="flex items-center gap-2 rounded-xl bg-zinc-100 px-3 py-2 text-xs text-zinc-600 dark:bg-zinc-800/70 dark:text-zinc-300">
          <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-[10px] font-bold text-white dark:bg-white dark:text-zinc-900">
            🔒 READ-ONLY
          </span>
          You can cheer {owner.name} on, but only {owner.name} can tick these boxes.
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
          Sort: {asc ? `${formatINR(plan.start)} → ${formatINR(lastBox(plan))}` : `${formatINR(lastBox(plan))} → ${formatINR(plan.start)}`} ⇅
        </button>
      </div>

      {visible.length === 0 ? (
        <p className="rounded-2xl bg-white p-8 text-center text-sm text-zinc-500 ring-1 ring-black/5 dark:bg-zinc-900 dark:ring-white/10">
          {filter === "completed" ? "Nothing ticked yet — first box is the hardest! 💪" : `All ${BOX_COUNT} done. Legend. 🏆`}
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
                    ? `${checkedStyle} animate-pop shadow-sm`
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
