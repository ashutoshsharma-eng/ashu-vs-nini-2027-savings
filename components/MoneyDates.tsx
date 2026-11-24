"use client";

import { useState, useTransition } from "react";
import { updateMoneyDateAction } from "@/app/actions";
import { PLAYERS, formatSunday, monthOf } from "@/lib/constants";
import { chaiVerdict, endOfDayIST } from "@/lib/stats";
import type { BoxRow, MoneyDateRow } from "@/lib/types";

type Props = {
  boxes: BoxRow[];
  dates: MoneyDateRow[];
  now: number;
  onError: (msg: string) => void;
};

export default function MoneyDates({ boxes, dates, now, onError }: Props) {
  const done = dates.filter((d) => d.isCompleted).length;
  const next = dates.find((d) => endOfDayIST(d.sundayDate) >= now) ?? null;
  const nextMonth = next ? monthOf(next.sundayDate) : null;

  const months: { label: string; items: MoneyDateRow[] }[] = [];
  for (const d of dates) {
    const label = monthOf(d.sundayDate);
    const group = months.at(-1);
    if (group?.label === label) group.items.push(d);
    else months.push({ label, items: [d] });
  }

  return (
    <section className="space-y-3">
      <div className="rounded-2xl bg-white p-4 text-sm shadow-sm ring-1 ring-black/5 dark:bg-zinc-900 dark:ring-white/10">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-semibold">Every Sunday = Money Date 💑</p>
            <p className="mt-1 text-zinc-600 dark:text-zinc-400">
              Review the week together. Whoever ticked fewer boxes that week buys the chai (ties
              fall back to total ticks).
            </p>
          </div>
          <div className="shrink-0 rounded-xl bg-emerald-50 px-3 py-2 text-center dark:bg-emerald-950/40">
            <div className="text-lg font-extrabold tabular-nums text-emerald-700 dark:text-emerald-300">
              {done}/{dates.length}
            </div>
            <div className="text-[10px] font-semibold uppercase text-emerald-700/70 dark:text-emerald-300/70">
              done
            </div>
          </div>
        </div>
        {next && (
          <button
            type="button"
            onClick={() =>
              document
                .getElementById(`sunday-${next.weekIndex}`)
                ?.scrollIntoView({ behavior: "smooth", block: "center" })
            }
            className="mt-3 w-full rounded-xl bg-amber-100 px-3 py-2 text-xs font-semibold text-amber-800 active:scale-[0.99] dark:bg-amber-900/40 dark:text-amber-300"
          >
            ⏭ Next Money Date: {formatSunday(next.sundayDate, true)} — jump there
          </button>
        )}
      </div>

      {months.map((m) => {
        const monthDone = m.items.filter((d) => d.isCompleted).length;
        const isPast = m.items.every((d) => endOfDayIST(d.sundayDate) < now);
        return (
          <details
            key={m.label}
            open={m.label === nextMonth || (!next && m === months.at(-1))}
            className="group rounded-2xl bg-white/60 ring-1 ring-black/5 dark:bg-zinc-900/50 dark:ring-white/10"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-bold">
              <span>
                {m.label} {isPast && <span className="font-normal text-zinc-500">· past</span>}
              </span>
              <span className="flex items-center gap-2 text-xs font-semibold text-zinc-500">
                {monthDone}/{m.items.length} done
                <span className="transition group-open:rotate-180">▾</span>
              </span>
            </summary>
            <ul className="space-y-2 px-3 pb-3">
              {m.items.map((d) => (
                <MoneyDateCard
                  key={`${d.id}-${d.isCompleted}-${d.notes}`}
                  date={d}
                  boxes={boxes}
                  isNext={next?.weekIndex === d.weekIndex}
                  onError={onError}
                />
              ))}
            </ul>
          </details>
        );
      })}
    </section>
  );
}

function MoneyDateCard({
  date,
  boxes,
  isNext,
  onError,
}: {
  date: MoneyDateRow;
  boxes: BoxRow[];
  isNext: boolean;
  onError: (msg: string) => void;
}) {
  const [completed, setCompleted] = useState(date.isCompleted);
  const [note, setNote] = useState(date.notes);
  const [pending, startTransition] = useTransition();
  const verdict = chaiVerdict(boxes, date.weekIndex);

  function save(nextCompleted: boolean, nextNote: string) {
    startTransition(async () => {
      const res = await updateMoneyDateAction(date.weekIndex, nextCompleted, nextNote);
      if (!res.ok) {
        onError(res.error);
        setCompleted(date.isCompleted);
      }
    });
  }

  return (
    <li
      id={`sunday-${date.weekIndex}`}
      className={`scroll-mt-24 rounded-xl p-3 ring-1 transition ${
        completed
          ? "bg-emerald-50 ring-emerald-200 dark:bg-emerald-950/30 dark:ring-emerald-900"
          : isNext
            ? "bg-white ring-2 ring-amber-400 dark:bg-zinc-900"
            : "bg-white ring-black/5 dark:bg-zinc-900 dark:ring-white/10"
      } ${pending ? "opacity-70" : ""}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-bold">{formatSunday(date.sundayDate)}</span>
            <span className="text-[10px] font-semibold text-zinc-500">Week {date.weekIndex}</span>
            {isNext && !completed && (
              <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold text-amber-950">
                NEXT
              </span>
            )}
          </div>
          <div className="mt-0.5 truncate text-xs font-semibold text-amber-700 dark:text-amber-300">
            ☕ Who pays for the chai →{" "}
            {verdict.payer ? `${PLAYERS[verdict.payer].emoji} ${PLAYERS[verdict.payer].name}` : "Both 🤝"}
          </div>
          <div className="truncate text-[10px] text-zinc-500">{verdict.reason}</div>
        </div>
        <label className="flex shrink-0 cursor-pointer items-center gap-2">
          <span className="sr-only">Mark Money Date done</span>
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
        className="mt-2 w-full rounded-lg bg-zinc-50 px-3 py-2 text-sm ring-1 ring-black/10 outline-none focus:ring-2 focus:ring-emerald-500 dark:bg-zinc-800 dark:ring-white/10"
      />
    </li>
  );
}
