"use client";

import { useEffect, useMemo, useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { logoutAction, toggleBoxAction } from "@/app/actions";
import { MILESTONE_STEP, PLAYERS, formatINR, type Player } from "@/lib/constants";
import { celebrateMilestone, celebrateTick } from "@/lib/confetti";
import { computeStats } from "@/lib/stats";
import type { BoxRow, BucketItem, MoneyDateRow } from "@/lib/types";
import { useIdleLogout } from "@/lib/useIdleLogout";
import BoxGrid from "./BoxGrid";
import BucketList from "./BucketList";
import CelebrationOverlay from "./CelebrationOverlay";
import ConfirmSheet from "./ConfirmSheet";
import DefaultPinBanner from "./DefaultPinBanner";
import MoneyDates from "./MoneyDates";
import Scoreboard from "./Scoreboard";
import StakesBanner from "./StakesBanner";

type Props = {
  me: Player;
  boxes: BoxRow[];
  moneyDates: MoneyDateRow[];
  bucket: BucketItem[];
  defaultPins: boolean;
  serverNow: number;
};

type Tab = "grids" | "dates" | "bucket";
const POLL_MS = 15_000;

const TABS: [Tab, string][] = [
  ["grids", "🧱 Boxes"],
  ["dates", "☕ Sundays"],
  ["bucket", "🎯 Bucket List"],
];

/** Who ticked most recently — used to credit a milestone. */
function latestTicker(boxes: BoxRow[]): Player | null {
  let best: BoxRow | null = null;
  for (const b of boxes) {
    if (b.isChecked && b.checkedAt && (!best || b.checkedAt > (best.checkedAt ?? ""))) best = b;
  }
  return best?.player ?? null;
}

export default function Dashboard({ me, boxes, moneyDates, bucket, defaultPins, serverNow }: Props) {
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
  const { secondsLeft } = useIdleLogout();

  const stats = useMemo(() => computeStats(optimisticBoxes), [optimisticBoxes]);
  const combined = stats.husband.total + stats.wife.total;

  // --- Milestones: every ₹10,000 crossed together (by either of you) -------------------
  const floor = Math.floor(combined / MILESTONE_STEP);
  const [seenFloor, setSeenFloor] = useState(floor);
  const [celebration, setCelebration] = useState<{ amount: number; by: Player } | null>(null);
  if (floor !== seenFloor) {
    // Adjusting state while rendering (React's recommended pattern for reacting to prop changes)
    setSeenFloor(floor);
    if (floor > seenFloor) {
      setCelebration({ amount: floor * MILESTONE_STEP, by: latestTicker(optimisticBoxes) ?? me });
      setToast(`🎉 Together you crossed ${formatINR(floor * MILESTONE_STEP)}!`);
    }
  }

  useEffect(() => {
    if (!celebration) return;
    celebrateMilestone();
    const id = window.setTimeout(() => setCelebration(null), 5000);
    return () => window.clearTimeout(id);
  }, [celebration]);

  // Live updates: poll while visible, and refresh on return to the app.
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
    if (checked) celebrateTick();
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

  const pill =
    "rounded-full bg-white px-3 py-1.5 text-xs font-semibold ring-1 ring-black/10 active:scale-95 dark:bg-zinc-900 dark:ring-white/10";

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
          <a href="/api/export" download className={pill} title="Download progress as Excel">
            ⬇︎ Excel
          </a>
          <form action={logoutAction}>
            <button type="submit" className={pill} title={`Signed in as ${PLAYERS[me].name} — switch profile`}>
              {PLAYERS[me].emoji} Logout
            </button>
          </form>
        </div>
      </header>

      {defaultPins && <DefaultPinBanner />}

      <Scoreboard stats={stats} me={me} />
      <StakesBanner stats={stats} now={serverNow} />

      <nav className="sticky top-0 z-10 -mx-4 bg-[var(--background)]/90 px-4 py-2 backdrop-blur">
        <div className="grid grid-cols-3 rounded-xl bg-zinc-200/70 p-1 text-[13px] font-semibold dark:bg-zinc-800">
          {TABS.map(([key, label]) => (
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

      {tab === "grids" && (
        <BoxGrid
          me={me}
          viewing={viewing}
          onViewingChange={setViewing}
          boxes={optimisticBoxes}
          onBoxPress={onBoxPress}
        />
      )}
      {tab === "dates" && (
        <MoneyDates boxes={optimisticBoxes} dates={moneyDates} now={serverNow} onError={setToast} />
      )}
      {tab === "bucket" && <BucketList me={me} items={bucket} stats={stats} onToast={setToast} />}

      <footer className="pb-4 pt-2 text-center text-[11px] text-zinc-500">
        Updates live every few seconds · Auto-logout after 5 min idle
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

      {celebration && (
        <CelebrationOverlay
          amount={celebration.amount}
          byName={PLAYERS[celebration.by].name}
          onClose={() => setCelebration(null)}
        />
      )}

      {secondsLeft !== null && (
        <div className="fixed inset-x-0 top-0 z-[60] flex justify-center px-4 safe-top" role="alert">
          <div className="animate-pop rounded-2xl bg-amber-400 px-4 py-2.5 text-center text-sm font-semibold text-amber-950 shadow-xl">
            Still there? Logging out in {secondsLeft}s — tap anywhere to stay 👆
          </div>
        </div>
      )}

      {toast && (
        <div
          role="status"
          className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex justify-center px-4 safe-bottom"
        >
          <div className="animate-pop rounded-full bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white shadow-xl dark:bg-white dark:text-zinc-900">
            {toast}
          </div>
        </div>
      )}
    </div>
  );
}
