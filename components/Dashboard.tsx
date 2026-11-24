"use client";

import { useEffect, useMemo, useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { logoutAction, toggleBoxAction } from "@/app/actions";
import { MILESTONE_STEP, PLAYERS, formatINR, type Player } from "@/lib/constants";
import { celebrateMilestone, celebrateTick } from "@/lib/confetti";
import { buildCsv, computeStats } from "@/lib/stats";
import type { BoxRow, MoneyDateRow } from "@/lib/types";
import BoxGrid from "./BoxGrid";
import ConfirmSheet from "./ConfirmSheet";
import DefaultPinBanner from "./DefaultPinBanner";
import MoneyDates from "./MoneyDates";
import Scoreboard from "./Scoreboard";
import StakesBanner from "./StakesBanner";

type Props = {
  me: Player;
  boxes: BoxRow[];
  moneyDates: MoneyDateRow[];
  defaultPins: boolean;
  serverNow: number;
};

type Tab = "grids" | "dates";
const POLL_MS = 15_000;

export default function Dashboard({ me, boxes, moneyDates, defaultPins, serverNow }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [optimisticBoxes, applyOptimistic] = useOptimistic(
    boxes,
    (state: BoxRow[], upd: { id: number; checked: boolean; at: string }) =>
      state.map((b) =>
        b.id === upd.id ? { ...b, isChecked: upd.checked, checkedAt: upd.checked ? upd.at : null } : b,
      ),
  );

  const [tab, setTab] = useState<Tab>("grids");
  const [viewing, setViewing] = useState<Player>(me);
  const [confirmBox, setConfirmBox] = useState<BoxRow | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const stats = useMemo(() => computeStats(optimisticBoxes), [optimisticBoxes]);
  const combined = stats.husband.total + stats.wife.total;

  // Live updates: poll while the tab is visible, and refresh on return to the app.
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const id = window.setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [router]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(id);
  }, [toast]);

  function commit(box: BoxRow, checked: boolean) {
    const before = combined;
    if (checked) {
      celebrateTick();
      const after = before + box.amount;
      if (Math.floor(after / MILESTONE_STEP) > Math.floor(before / MILESTONE_STEP)) {
        const hit = Math.floor(after / MILESTONE_STEP) * MILESTONE_STEP;
        window.setTimeout(celebrateMilestone, 250);
        setToast(`🎉 Together you crossed ${formatINR(hit)}!`);
      }
    }
    startTransition(async () => {
      applyOptimistic({ id: box.id, checked, at: new Date().toISOString() });
      const res = await toggleBoxAction(box.id, checked);
      if (!res.ok) setToast(res.error);
    });
  }

  function onBoxPress(box: BoxRow) {
    if (box.player !== me) {
      setToast(`🔒 Only ${PLAYERS[box.player].name} can tick these boxes`);
      return;
    }
    if (box.isChecked) setConfirmBox(box);
    else commit(box, true);
  }

  function exportCsv() {
    const csv = buildCsv(optimisticBoxes, moneyDates);
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `husband-vs-wife-2027-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div className="safe-top safe-bottom mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4">
      <header className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
            2027 Savings
          </p>
          <h1 className="truncate text-xl font-extrabold">Husband 🆚 Wife</h1>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={exportCsv}
            className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold ring-1 ring-black/10 active:scale-95 dark:bg-zinc-900 dark:ring-white/10"
          >
            ⬇︎ CSV
          </button>
          <form action={logoutAction}>
            <button
              type="submit"
              className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold ring-1 ring-black/10 active:scale-95 dark:bg-zinc-900 dark:ring-white/10"
              title={`Signed in as ${PLAYERS[me].name} — switch profile`}
            >
              {PLAYERS[me].emoji} Logout
            </button>
          </form>
        </div>
      </header>

      {defaultPins && <DefaultPinBanner />}

      <Scoreboard stats={stats} me={me} />
      <StakesBanner stats={stats} now={serverNow} />

      <nav className="sticky top-0 z-10 -mx-4 bg-[var(--background)]/90 px-4 py-2 backdrop-blur">
        <div className="grid grid-cols-2 rounded-xl bg-zinc-200/70 p-1 text-sm font-semibold dark:bg-zinc-800">
          {(
            [
              ["grids", "🧱 Boxes"],
              ["dates", "☕ Money Dates"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`rounded-lg py-2 transition ${
                tab === key ? "bg-white shadow-sm dark:bg-zinc-950" : "text-zinc-500"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </nav>

      {tab === "grids" ? (
        <BoxGrid
          me={me}
          viewing={viewing}
          onViewingChange={setViewing}
          boxes={optimisticBoxes}
          onBoxPress={onBoxPress}
        />
      ) : (
        <MoneyDates boxes={optimisticBoxes} dates={moneyDates} onError={setToast} />
      )}

      <footer className="pb-4 pt-2 text-center text-[11px] text-zinc-500">
        Updates live every few seconds · Tick in any order you like
      </footer>

      {confirmBox && (
        <ConfirmSheet
          title={`Untick ${formatINR(confirmBox.amount)}?`}
          body="This removes it from your total. You can always tick it again later."
          confirmLabel="Yes, untick"
          onCancel={() => setConfirmBox(null)}
          onConfirm={() => {
            commit(confirmBox, false);
            setConfirmBox(null);
          }}
        />
      )}

      {toast && (
        <div
          role="status"
          className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 safe-bottom pointer-events-none"
        >
          <div className="animate-pop rounded-full bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white shadow-xl dark:bg-white dark:text-zinc-900">
            {toast}
          </div>
        </div>
      )}
    </div>
  );
}
