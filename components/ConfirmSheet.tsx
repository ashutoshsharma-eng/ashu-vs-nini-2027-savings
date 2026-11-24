"use client";

import { useEffect } from "react";

type Props = {
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmSheet({ title, body, confirmLabel, onConfirm, onCancel }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
    >
      <div
        className="animate-sheet safe-bottom w-full max-w-md rounded-t-3xl bg-white p-5 shadow-2xl dark:bg-zinc-900 sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="confirm-title" className="text-lg font-bold">
          {title}
        </h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{body}</p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl bg-zinc-100 py-3 font-semibold dark:bg-zinc-800"
          >
            Keep it
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-xl bg-red-600 py-3 font-semibold text-white"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
