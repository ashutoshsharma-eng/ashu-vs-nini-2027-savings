"use client";

import { useState } from "react";
import { usePushReminders } from "@/lib/usePushReminders";

const SCHEDULE = "Fri 7 pm · Sat 10 am · Sat 7 pm · Sun 10 am";
const DISMISS_KEY = "hvw-reminder-banner-dismissed";

function readDismissed(): boolean {
  try {
    return typeof window !== "undefined" && window.localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

const btn = "rounded-xl px-4 py-2.5 text-sm font-semibold active:scale-[0.98] disabled:opacity-50";

/** Full controls, shown in ⚙️ Settings. */
export function RemindersCard({ onToast }: { onToast: (msg: string) => void }) {
  const { status, busy, enable, disable, test } = usePushReminders();
  const report = (err: string | null, ok: string) => onToast(err ?? ok);

  return (
    <section className="space-y-3 rounded-2xl bg-white p-4 ring-1 ring-black/5 dark:bg-zinc-900 dark:ring-white/10">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold">🔔 Sunday reminders</h3>
        {status === "on" && (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
            ON
          </span>
        )}
      </div>
      <p className="text-xs text-zinc-600 dark:text-zinc-400">
        If you haven&apos;t ticked a box since last Sunday, this phone gets a nudge: {SCHEDULE}. Tick one and the
        rest of that week&apos;s reminders stop.
      </p>

      {status === "checking" && <p className="text-xs text-zinc-500">Checking this phone…</p>}

      {status === "needs-install" && (
        <p className="rounded-xl bg-sky-50 p-3 text-xs text-sky-800 dark:bg-sky-950/40 dark:text-sky-300">
          📲 On iPhone, reminders only work from the Home Screen app. In Safari tap <b>Share → Add to Home Screen</b>,
          open the app from that icon, then come back here.
        </p>
      )}

      {status === "unsupported" && (
        <p className="text-xs text-zinc-500">This browser can&apos;t show notifications. Try Safari (iPhone) or Chrome (Android).</p>
      )}

      {status === "blocked" && (
        <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          Notifications are blocked for this app. On iPhone: <b>Settings → Notifications → this app → Allow</b>, then
          reopen the app.
        </p>
      )}

      {status === "off" && (
        <button
          type="button"
          disabled={busy}
          onClick={async () => report(await enable(), "Reminders are on 🔔")}
          className={`${btn} w-full bg-emerald-600 text-white`}
        >
          {busy ? "Turning on…" : "Turn on reminders on this phone"}
        </button>
      )}

      {status === "on" && (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={async () => report(await test(), "Test sent — check your notifications")}
            className={`${btn} bg-zinc-100 dark:bg-zinc-800`}
          >
            Send a test
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={async () => report(await disable(), "Reminders turned off on this phone")}
            className={`${btn} bg-red-50 text-red-600 dark:bg-red-950/40`}
          >
            Turn off
          </button>
        </div>
      )}
    </section>
  );
}

/** A one-time nudge on the dashboard until reminders are on (or it's dismissed). */
export function RemindersBanner({ onToast }: { onToast: (msg: string) => void }) {
  const { status, busy, enable } = usePushReminders();
  const [dismissed, setDismissed] = useState(readDismissed);

  if (dismissed || (status !== "off" && status !== "needs-install")) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* private mode — just hide it for now */
    }
  };

  return (
    <div className="flex items-start gap-3 rounded-2xl bg-sky-50 p-3 text-xs text-sky-900 ring-1 ring-sky-200 dark:bg-sky-950/40 dark:text-sky-200 dark:ring-sky-900">
      <span className="text-xl leading-none">🔔</span>
      <div className="min-w-0 flex-1">
        {status === "needs-install" ? (
          <p>
            Want a nudge before Sunday if you haven&apos;t ticked a box? Add this app to your Home Screen (
            <b>Share → Add to Home Screen</b>), open it from there and turn on reminders in ⚙️.
          </p>
        ) : (
          <>
            <p>Get a nudge before Sunday if you haven&apos;t ticked a box that week.</p>
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                const err = await enable();
                onToast(err ?? "Reminders are on 🔔");
              }}
              className="mt-2 rounded-full bg-sky-600 px-3 py-1.5 font-semibold text-white active:scale-95 disabled:opacity-50"
            >
              {busy ? "Turning on…" : "Turn on reminders"}
            </button>
          </>
        )}
      </div>
      <button type="button" onClick={dismiss} aria-label="Dismiss" className="px-1 text-base leading-none text-sky-700/60">
        ✕
      </button>
    </div>
  );
}
