"use client";

import { formatINR } from "@/lib/constants";

type Props = { amount: number; byName: string; onClose: () => void };

const FLOATERS = ["🎉", "🥳", "🍾", "🎊", "🥂", "👏", "💃", "🕺"];

export default function CelebrationOverlay({ amount, byName, onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-6 backdrop-blur-[2px]"
      onClick={onClose}
      role="alertdialog"
      aria-live="assertive"
      aria-label={`Milestone: ${formatINR(amount)} saved together`}
    >
      {FLOATERS.map((e, i) => (
        <span
          key={i}
          aria-hidden
          className="animate-float pointer-events-none absolute text-4xl"
          style={{ left: `${8 + i * 11}%`, animationDelay: `${(i % 4) * 0.18}s` }}
        >
          {e}
        </span>
      ))}
      <div className="animate-celebrate relative w-full max-w-sm rounded-3xl bg-gradient-to-br from-amber-300 via-pink-400 to-violet-500 p-[3px] shadow-2xl">
        <div className="rounded-[22px] bg-white px-6 py-7 text-center dark:bg-zinc-950">
          <div className="text-5xl">🥂🎉🍾</div>
          <p className="mt-3 text-sm font-bold uppercase tracking-[0.25em] text-pink-600 dark:text-pink-400">
            Cheers!
          </p>
          <p className="mt-1 text-4xl font-black tabular-nums">{formatINR(amount)}</p>
          <p className="mt-1 text-base font-semibold">saved together 💑</p>
          <p className="mt-3 text-xs text-zinc-500">{byName} just pushed you past the milestone</p>
          <button
            type="button"
            onClick={onClose}
            className="mt-5 w-full rounded-2xl bg-zinc-900 py-3 font-semibold text-white active:scale-[0.98] dark:bg-white dark:text-zinc-900"
          >
            Let&apos;s keep going 🚀
          </button>
        </div>
      </div>
    </div>
  );
}
