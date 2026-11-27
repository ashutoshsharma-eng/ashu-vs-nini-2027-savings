"use client";

import { useEffect, useMemo, useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { logoutAction, toggleBoxAction } from "@/app/actions";
import { MILESTONE_STEP, formatINR } from "@/lib/constants";
import { celebrateMilestone, celebrateTick } from "@/lib/confetti";
import { lastBox, type Plan } from "@/lib/plan";
import { computeStats, groupTotal } from "@/lib/stats";
import type { BoxRow, BucketItem, Member, MoneyDateRow } from "@/lib/types";
import { useIdleLogout } from "@/lib/useIdleLogout";
import BoxGrid from "./BoxGrid";
import BucketList from "./BucketList";
import CelebrationOverlay from "./CelebrationOverlay";
import ConfirmSheet from "./ConfirmSheet";
import DefaultPinBanner from "./DefaultPinBanner";
import MoneyDates from "./MoneyDates";
import PlanSetup from "./PlanSetup";
import { RemindersBanner } from "./Reminders";
import Scoreboard from "./Scoreboard";
import SettingsSheet from "./SettingsSheet";
import StakesBanner from "./StakesBanner";

type Props = {
  me: Member;
  members: Member[];
  groupName: string;
  boxes: BoxRow[];
  moneyDates: MoneyDateRow[];
  bucket: BucketItem[];
  plan: Plan;
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
function latestTicker(boxes: BoxRow[]): number | null {
  let best: BoxRow | null = null;
  for (const b of boxes) {
    if (b.isChecked && b.checkedAt && (!best || b.checkedAt > (best.checkedAt ?? ""))) best = b;
  }
  return best?.memberId ?? null;
}

export default function Dashboard({
  me,
  members,
  groupName,
  boxes,
  moneyDates,
  bucket,
  plan,
  serverNow,
}: Props) {
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
  const [viewing, setViewing] = useState<number>(me.id);
  const [confirmBox, setConfirmBox] = useState<BoxRow | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [editingPlan, setEditingPlan] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const solo = members.length === 1;
  const byId = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  const { secondsLeft } = useIdleLogout();

  const stats = useMemo(() => computeStats(optimisticBoxes, members), [optimisticBoxes, members]);
  const combined = groupTotal(stats, members);
  const locked = optimisticBoxes.some((b) => b.isChecked);

  // --- Milestones: every ₹10,000 crossed (together, or solo) ---------------------------
  const floor = Math.floor(combined / MILESTONE_STEP);
  const [seenFloor, setSeenFloor] = useState(floor);
  const [celebration, setCelebration] = useState<{ amount: number; by: Member } | null>(null);
  if (floor !== seenFloor) {
    // Adjusting state while rendering (React's recommended pattern for reacting to prop changes)
    setSeenFloor(floor);
    if (floor > seenFloor) {
      setCelebration({ amount: floor * MILESTONE_STEP, by: byId.get(latestTicker(optimisticBoxes) ?? -1) ?? me });
      setToast(`🎉 ${solo ? "You" : "Together you"} crossed ${formatINR(floor * MILESTONE_STEP)}!`);
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
    if (box.memberId !== me.id) {
      setToast(`🔒 Only ${byId.get(box.memberId)?.name ?? "they"} can tick these boxes`);
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
          <h1 className="line-clamp-2 break-words text-lg font-extrabold leading-tight">{groupName}</h1>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <a href="/api/export" download className={pill} title="Download progress as Excel">
            ⬇︎ Excel
          </a>
          <button type="button" onClick={() => setSettingsOpen(true)} className={pill} title="Settings" aria-label="Settings">
            ⚙️
          </button>
          <form action={logoutAction}>
            <button type="submit" className={pill} title={`Signed in as ${me.name} — switch profile`}>
              {me.emoji} Logout
            </button>
          </form>
        </div>
      </header>

      {me.pinIsDefault && <DefaultPinBanner onFix={() => setSettingsOpen(true)} />}
      {plan.configured && <RemindersBanner onToast={setToast} />}

      {!plan.configured ? (
        <PlanSetup plan={plan} memberCount={members.length} mode="initial" onError={setToast} />
      ) : (
        <>
        <Scoreboard stats={stats} me={me} members={members} plan={plan} />
        <StakesBanner stats={stats} members={members} now={serverNow} />

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

        {tab === "grids" && editingPlan && !locked && (
          <PlanSetup plan={plan} memberCount={members.length} mode="edit" onDone={() => setEditingPlan(false)} onError={setToast} />
        )}
        {tab === "grids" && !(editingPlan && !locked) && (
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 text-sm shadow-sm ring-1 ring-black/5 dark:bg-zinc-900 dark:ring-white/10">
            <div className="min-w-0">
              <div className="truncate font-semibold tabular-nums">
                📋 {formatINR(plan.start)} → {formatINR(lastBox(plan))} · steps of {formatINR(plan.step)}
              </div>
              <div className="text-xs text-zinc-500">
                {plan.count} boxes{solo ? "" : " each"}
                {plan.updatedBy && byId.get(plan.updatedBy) && !solo ? ` · set by ${byId.get(plan.updatedBy)?.name}` : ""}
                {locked ? " · locked for the year" : " · locks at the first tick"}
              </div>
            </div>
            {locked ? (
              <span className="shrink-0 text-lg" title="Plan locked">
                🔒
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setEditingPlan(true)}
                className="shrink-0 rounded-full bg-zinc-100 px-3 py-1.5 text-xs font-semibold active:scale-95 dark:bg-zinc-800"
              >
                ✏️ Edit
              </button>
            )}
          </div>
        )}
        {tab === "grids" && !(editingPlan && !locked) && (
          <BoxGrid
            plan={plan}
            me={me}
            members={members}
            viewing={viewing}
            onViewingChange={setViewing}
            boxes={optimisticBoxes}
            onBoxPress={onBoxPress}
          />
        )}
        {tab === "dates" && (
          <MoneyDates members={members} boxes={optimisticBoxes} dates={moneyDates} now={serverNow} onError={setToast} />
        )}
        {tab === "bucket" && <BucketList me={me} members={members} items={bucket} stats={stats} onToast={setToast} />}
        </>
      )}

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
          byName={celebration.by.name}
          solo={solo}
          onClose={() => setCelebration(null)}
        />
      )}

      {settingsOpen && (
        <SettingsSheet
          me={me}
          members={members}
          groupName={groupName}
          onClose={() => setSettingsOpen(false)}
          onToast={setToast}
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
