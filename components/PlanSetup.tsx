"use client";

import { useState, useTransition } from "react";
import { savePlanAction } from "@/app/actions";
import { formatINR } from "@/lib/constants";
import {
  COUNT_SUGGESTIONS,
  START_SUGGESTIONS,
  STEP_SUGGESTIONS,
  WEEKS_IN_YEAR,
  lastBox,
  planTarget,
  validatePlan,
  type Plan,
} from "@/lib/plan";

type Props = {
  plan: Plan;
  mode: "initial" | "edit";
  onDone?: () => void;
  onError: (msg: string) => void;
};

const SAME = "same";
const CUSTOM = "custom";

function toInt(v: string): number {
  return Number(v.replace(/[₹,\s]/g, ""));
}

const chip = (active: boolean) =>
  `rounded-full px-3 py-1.5 text-xs font-semibold tabular-nums transition active:scale-95 ${
    active
      ? "bg-emerald-600 text-white"
      : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
  }`;

const field =
  "w-full rounded-xl bg-zinc-50 px-3 py-3 text-lg font-bold tabular-nums ring-1 ring-black/10 outline-none focus:ring-2 focus:ring-emerald-500 dark:bg-zinc-800 dark:ring-white/10";

export default function PlanSetup({ plan, mode, onDone, onError }: Props) {
  const [startText, setStartText] = useState(String(plan.start));
  const [stepMode, setStepMode] = useState<string>(
    plan.step === plan.start ? SAME : STEP_SUGGESTIONS.includes(plan.step) ? String(plan.step) : CUSTOM,
  );
  const [customStep, setCustomStep] = useState(String(plan.step));
  const [countText, setCountText] = useState(String(plan.count));
  const [pending, startTransition] = useTransition();

  const start = toInt(startText);
  const step = stepMode === SAME ? start : stepMode === CUSTOM ? toInt(customStep) : Number(stepMode);
  const count = toInt(countText);
  const error = startText && countText ? validatePlan(start, step, count) : "Fill in all the amounts.";
  const draft = { start, step, count };
  const each = error ? 0 : planTarget(draft);
  const perWeek = each / WEEKS_IN_YEAR;
  const boxesPerWeek = count / WEEKS_IN_YEAR;

  function save() {
    if (error) return;
    startTransition(async () => {
      const res = await savePlanAction(start, step, count);
      if (res.ok) onDone?.();
      else onError(res.error);
    });
  }

  return (
    <section className="space-y-4 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5 dark:bg-zinc-900 dark:ring-white/10">
      <div>
        <h2 className="text-xl font-extrabold">
          {mode === "initial" ? "Set up your challenge 🎯" : "Edit the plan ✏️"}
        </h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          You both play the same plan. Either of you can change it until the first box is ticked —
          then it&apos;s locked for the year.
        </p>
      </div>

      <div className="space-y-2">
        <label htmlFor="plan-start" className="text-sm font-semibold">
          First box (starting amount)
        </label>
        <input
          id="plan-start"
          inputMode="numeric"
          value={startText ? `₹${toInt(startText).toLocaleString("en-IN")}` : ""}
          onChange={(e) => setStartText(e.target.value.replace(/\D/g, "").slice(0, 7))}
          placeholder="₹100"
          className={field}
        />
        <div className="flex flex-wrap gap-2">
          {START_SUGGESTIONS.map((v) => (
            <button key={v} type="button" onClick={() => setStartText(String(v))} className={chip(start === v)}>
              {formatINR(v)}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="plan-step" className="text-sm font-semibold">
          Increase each box by
        </label>
        <select
          id="plan-step"
          value={stepMode}
          onChange={(e) => setStepMode(e.target.value)}
          className={`${field} appearance-none`}
        >
          <option value={SAME}>Same as first box{start ? ` (${formatINR(start)})` : ""}</option>
          {STEP_SUGGESTIONS.filter((v) => v !== start).map((v) => (
            <option key={v} value={String(v)}>
              {formatINR(v)}
            </option>
          ))}
          <option value={CUSTOM}>Custom amount…</option>
        </select>
        {stepMode === CUSTOM && (
          <input
            inputMode="numeric"
            aria-label="Custom step amount"
            value={customStep ? `₹${toInt(customStep).toLocaleString("en-IN")}` : ""}
            onChange={(e) => setCustomStep(e.target.value.replace(/\D/g, "").slice(0, 7))}
            placeholder="₹75"
            className={field}
          />
        )}
      </div>

      <div className="space-y-2">
        <label htmlFor="plan-count" className="text-sm font-semibold">
          Number of boxes each
        </label>
        <div className="flex items-center gap-2">
          <input
            id="plan-count"
            inputMode="numeric"
            value={countText}
            onChange={(e) => setCountText(e.target.value.replace(/\D/g, "").slice(0, 3))}
            className={`${field.replace("w-full ", "")} w-20 shrink-0 text-center`}
          />
          <div className="flex flex-wrap gap-2">
            {COUNT_SUGGESTIONS.map((v) => (
              <button key={v} type="button" onClick={() => setCountText(String(v))} className={chip(count === v)}>
                {v}
                {v === 52 ? " · 1/week" : v === 104 ? " · 2/week" : ""}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div
        className={`rounded-2xl p-4 ${
          error
            ? "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"
            : "bg-gradient-to-br from-emerald-500 to-teal-600 text-white"
        }`}
        aria-live="polite"
      >
        {error ? (
          <p className="text-sm font-medium">{error}</p>
        ) : (
          <>
            <p className="text-xs font-semibold uppercase tracking-wider text-white/80">Preview</p>
            <p className="mt-1 text-sm font-semibold">
              {formatINR(start)} → {formatINR(lastBox(draft))} · {count} boxes in steps of {formatINR(step)}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <div className="text-[11px] uppercase text-white/80">Each of you saves</div>
                <div className="text-xl font-extrabold tabular-nums">{formatINR(each)}</div>
              </div>
              <div>
                <div className="text-[11px] uppercase text-white/80">Together</div>
                <div className="text-xl font-extrabold tabular-nums">{formatINR(each * 2)}</div>
              </div>
            </div>
            <p className="mt-2 text-xs text-white/90">
              ≈ {formatINR(Math.round(perWeek))} a week each over 2027
              {count !== WEEKS_IN_YEAR &&
                ` · about ${boxesPerWeek % 1 === 0 ? boxesPerWeek : boxesPerWeek.toFixed(1)} boxes a week`}
            </p>
          </>
        )}
      </div>

      <div className="flex gap-2">
        {mode === "edit" && (
          <button
            type="button"
            onClick={onDone}
            className="rounded-2xl bg-zinc-100 px-5 py-3.5 font-semibold dark:bg-zinc-800"
          >
            Cancel
          </button>
        )}
        <button
          type="button"
          onClick={save}
          disabled={Boolean(error) || pending}
          className="flex-1 rounded-2xl bg-emerald-600 py-3.5 font-semibold text-white transition active:scale-[0.99] disabled:opacity-50"
        >
          {pending ? "Saving…" : mode === "initial" ? "Start the challenge 🚀" : "Save plan"}
        </button>
      </div>
    </section>
  );
}
