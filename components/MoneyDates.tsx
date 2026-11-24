"use client";

import { useState, useTransition } from "react";
import { updateMoneyDateAction } from "@/app/actions";
import { PLAYERS } from "@/lib/constants";
import { chaiVerdict } from "@/lib/stats";
import type { BoxRow, MoneyDateRow } from "@/lib/types";

type Props = {
  boxes: BoxRow[];
  dates: MoneyDateRow[];
  onError: (msg: string) => void;
};

export default function MoneyDates({ boxes, dates, onError }: Props) {
  const done = dates.filter((d) => d.isCompleted).length;
  return (
    <section className="space-y-3">
      <div className="rounded-2xl bg-white p-4 text-sm shadow-sm ring-1 ring-black/5 dark:bg-zinc-900 dark:ring-white/10">
        <p className="font-semibold">First Sunday of every month = Money Date 💑</p>
        <p className="mt-1 text-zinc-600 dark:text-zinc-400">
          Review the boxes together. Whoever ticked fewer boxes since the last Money Date buys the
          chai (ties fall back to total ticks). {done}/12 done.
        </p>
      </div>
      <ul className="space-y-3">
        {dates.map((d) => (
          <MoneyDateCard
            key={`${d.id}-${d.isCompleted}-${d.notes}`}
            date={d}
            boxes={boxes}
            onError={onError}
          />
        ))}
      </ul>
    </section>
  );
}

function MoneyDateCard({
  date,
  boxes,
  onError,
}: {
  date: MoneyDateRow;
  boxes: BoxRow[];
  onError: (msg: string) => void;
}) {
  const [completed, setCompleted] = useState(date.isCompleted);
  const [note, setNote] = useState(date.notes);
  const [pending, startTransition] = useTransition();
  const verdict = chaiVerdict(boxes, date.monthIndex);

  function save(nextCompleted: boolean, nextNote: string) {
    startTransition(async () => {
      const res = await updateMoneyDateAction(date.monthIndex, nextCompleted, nextNote);
      if (!res.ok) {
        onError(res.error);
        setCompleted(date.isCompleted);
      }
    });
  }

  return (
    <li
      className={`rounded-2xl p-4 shadow-sm ring-1 transition ${
        completed
          ? "bg-emerald-50 ring-emerald-200 dark:bg-emerald-950/30 dark:ring-emerald-900"
          : "bg-white ring-black/5 dark:bg-zinc-900 dark:ring-white/10"
      } ${pending ? "opacity-70" : ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            {date.monthLabel}
          </div>
          <div className="text-lg font-bold">Sun, {date.sundayDate}</div>
        </div>
        <label className="flex shrink-0 cursor-pointer items-center gap-2 text-xs font-semibold">
          <span>{completed ? "Done ✅" : "Mark done"}</span>
          <input
            type="checkbox"
            className="peer sr-only"
            checked={completed}
            onChange={(e) => {
              setCompleted(e.target.checked);
              save(e.target.checked, note);
            }}
          />
          <span className="relative h-6 w-11 rounded-full bg-zinc-300 transition peer-checked:bg-emerald-500 peer-focus-visible:ring-2 peer-focus-visible:ring-emerald-400 dark:bg-zinc-700 after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition peer-checked:after:translate-x-5" />
        </label>
      </div>

      <div className="mt-3 rounded-xl bg-amber-50 px-3 py-2 dark:bg-amber-950/30">
        <div className="text-sm font-bold text-amber-800 dark:text-amber-300">
          Who pays for the chai ☕ →{" "}
          {verdict.payer ? `${PLAYERS[verdict.payer].emoji} ${PLAYERS[verdict.payer].name}` : "Both 🤝"}
        </div>
        <div className="text-[11px] text-amber-700/80 dark:text-amber-300/70">{verdict.reason}</div>
      </div>

      <input
        type="text"
        value={note}
        maxLength={280}
        placeholder="Short note (where you went, wins, plans…)"
        onChange={(e) => setNote(e.target.value)}
        onBlur={() => {
          if (note !== date.notes) save(completed, note);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        className="mt-3 w-full rounded-xl bg-zinc-50 px-3 py-2 text-sm ring-1 ring-black/10 outline-none focus:ring-2 focus:ring-emerald-500 dark:bg-zinc-800 dark:ring-white/10"
      />
    </li>
  );
}
