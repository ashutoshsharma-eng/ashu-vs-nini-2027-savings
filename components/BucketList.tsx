"use client";

import { useState, useTransition } from "react";
import {
  addBucketItemAction,
  deleteBucketItemAction,
  updateBucketItemAction,
} from "@/app/actions";
import { PLAYER_KEYS, PLAYERS, formatINR, type Player } from "@/lib/constants";
import type { PlayerStats } from "@/lib/stats";
import type { BucketItem } from "@/lib/types";
import ConfirmSheet from "./ConfirmSheet";

type Props = {
  me: Player;
  items: BucketItem[];
  stats: Record<Player, PlayerStats>;
  onToast: (msg: string) => void;
};

const tabStyle: Record<Player, string> = {
  husband: "bg-sky-500 text-white",
  wife: "bg-pink-500 text-white",
};

function parseCost(v: string): number | null {
  const n = Number(v.replace(/[₹,\s]/g, ""));
  return v.trim() === "" || !Number.isFinite(n) ? null : n;
}

export default function BucketList({ me, items, stats, onToast }: Props) {
  const [viewing, setViewing] = useState<Player>(me);
  const [title, setTitle] = useState("");
  const [cost, setCost] = useState("");
  const [adding, startAdding] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState<BucketItem | null>(null);
  const readOnly = viewing !== me;

  const list = items.filter((i) => i.player === viewing);
  const planned = list.reduce((a, i) => a + (i.estCost ?? 0), 0);
  const saved = stats[viewing].total;
  const covered = planned > 0 ? Math.min(100, (saved / planned) * 100) : 0;
  const orderedPlayers = [me, ...PLAYER_KEYS.filter((p) => p !== me)];

  function add(e: React.FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    startAdding(async () => {
      const res = await addBucketItemAction(t, parseCost(cost));
      if (res.ok) {
        setTitle("");
        setCost("");
        onToast("Added to your bucket list ✨");
      } else onToast(res.error);
    });
  }

  return (
    <section className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {orderedPlayers.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setViewing(p)}
            className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
              viewing === p ? tabStyle[p] : "bg-white ring-1 ring-black/10 dark:bg-zinc-900 dark:ring-white/10"
            }`}
          >
            {p === me ? "My bucket list" : `${PLAYERS[p].name}'s 🔒`}
          </button>
        ))}
      </div>

      <div className="rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 p-4 text-white shadow-md">
        <p className="text-xs font-semibold uppercase tracking-wider text-white/70">
          {readOnly ? `${PLAYERS[viewing].name}'s plans` : "What my money is for"}
        </p>
        <div className="mt-1 flex items-baseline justify-between gap-2">
          <span className="text-2xl font-extrabold tabular-nums">{formatINR(planned)}</span>
          <span className="text-xs text-white/80">
            planned · {list.filter((i) => i.isDone).length}/{list.length} done
          </span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/20">
          <div className="h-full rounded-full bg-white transition-[width] duration-500" style={{ width: `${covered}%` }} />
        </div>
        <p className="mt-1 text-[11px] text-white/80">
          {planned > 0
            ? `${formatINR(saved)} saved covers ${covered.toFixed(0)}% of the plan`
            : "Add a cost to items to see how much of the plan your savings cover"}
        </p>
      </div>

      {readOnly ? (
        <div className="flex items-center gap-2 rounded-xl bg-zinc-100 px-3 py-2 text-xs text-zinc-600 dark:bg-zinc-800/70 dark:text-zinc-300">
          <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-[10px] font-bold text-white dark:bg-white dark:text-zinc-900">
            🔒 READ-ONLY
          </span>
          Only {PLAYERS[viewing].name} can edit this list.
        </div>
      ) : (
        <form
          onSubmit={add}
          className="space-y-2 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-black/5 dark:bg-zinc-900 dark:ring-white/10"
        >
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            placeholder="e.g. Goa trip, new iPad, Diwali gifts…"
            aria-label="Bucket list item"
            className="w-full rounded-lg bg-zinc-50 px-3 py-2.5 text-sm ring-1 ring-black/10 outline-none focus:ring-2 focus:ring-violet-500 dark:bg-zinc-800 dark:ring-white/10"
          />
          <div className="flex gap-2">
            <input
              value={cost}
              onChange={(e) => setCost(e.target.value)}
              inputMode="numeric"
              placeholder="₹ est. cost (optional)"
              aria-label="Estimated cost"
              className="min-w-0 flex-1 rounded-lg bg-zinc-50 px-3 py-2.5 text-sm ring-1 ring-black/10 outline-none focus:ring-2 focus:ring-violet-500 dark:bg-zinc-800 dark:ring-white/10"
            />
            <button
              type="submit"
              disabled={adding || !title.trim()}
              className="shrink-0 rounded-lg bg-violet-600 px-4 text-sm font-semibold text-white active:scale-95 disabled:opacity-50"
            >
              {adding ? "Adding…" : "+ Add"}
            </button>
          </div>
        </form>
      )}

      {list.length === 0 ? (
        <p className="rounded-2xl bg-white p-8 text-center text-sm text-zinc-500 ring-1 ring-black/5 dark:bg-zinc-900 dark:ring-white/10">
          {readOnly
            ? `${PLAYERS[viewing].name} hasn't added anything yet 👀`
            : "Nothing here yet — what are you saving for? 🎯"}
        </p>
      ) : (
        <ul className="space-y-2">
          {list.map((item) => (
            <BucketRow
              key={`${item.id}-${item.title}-${item.estCost}-${item.isDone}`}
              item={item}
              readOnly={readOnly}
              onToast={onToast}
              onDelete={() => setConfirmDelete(item)}
            />
          ))}
        </ul>
      )}

      {confirmDelete && (
        <ConfirmSheet
          title={`Delete “${confirmDelete.title}”?`}
          body="It will be removed from your bucket list."
          confirmLabel="Delete"
          onCancel={() => setConfirmDelete(null)}
          onConfirm={async () => {
            const target = confirmDelete;
            setConfirmDelete(null);
            const res = await deleteBucketItemAction(target.id);
            if (!res.ok) onToast(res.error);
          }}
        />
      )}
    </section>
  );
}

function BucketRow({
  item,
  readOnly,
  onToast,
  onDelete,
}: {
  item: BucketItem;
  readOnly: boolean;
  onToast: (msg: string) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(item.title);
  const [cost, setCost] = useState(item.estCost?.toString() ?? "");
  const [done, setDone] = useState(item.isDone);
  const [pending, start] = useTransition();

  function save(patch: { title: string; estCost: number | null; isDone: boolean }) {
    start(async () => {
      const res = await updateBucketItemAction(item.id, patch);
      if (!res.ok) {
        onToast(res.error);
        setDone(item.isDone);
      } else setEditing(false);
    });
  }

  if (editing) {
    return (
      <li className="space-y-2 rounded-xl bg-white p-3 ring-2 ring-violet-400 dark:bg-zinc-900">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          autoFocus
          aria-label="Item name"
          className="w-full rounded-lg bg-zinc-50 px-3 py-2 text-sm ring-1 ring-black/10 outline-none dark:bg-zinc-800 dark:ring-white/10"
        />
        <div className="flex gap-2">
          <input
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            inputMode="numeric"
            placeholder="₹ est. cost"
            aria-label="Estimated cost"
            className="min-w-0 flex-1 rounded-lg bg-zinc-50 px-3 py-2 text-sm ring-1 ring-black/10 outline-none dark:bg-zinc-800 dark:ring-white/10"
          />
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="rounded-lg bg-zinc-100 px-3 text-sm font-semibold dark:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={pending || !title.trim()}
            onClick={() => save({ title, estCost: parseCost(cost), isDone: done })}
            className="rounded-lg bg-violet-600 px-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </li>
    );
  }

  return (
    <li
      className={`flex items-center gap-3 rounded-xl p-3 ring-1 transition ${
        done
          ? "bg-emerald-50 ring-emerald-200 dark:bg-emerald-950/30 dark:ring-emerald-900"
          : "bg-white ring-black/5 dark:bg-zinc-900 dark:ring-white/10"
      } ${pending ? "opacity-60" : ""}`}
    >
      <button
        type="button"
        disabled={readOnly || pending}
        aria-pressed={done}
        aria-label={done ? "Mark as planned" : "Mark as done"}
        onClick={() => {
          const next = !done;
          setDone(next);
          save({ title: item.title, estCost: item.estCost, isDone: next });
        }}
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm ring-2 transition ${
          done ? "bg-emerald-500 text-white ring-emerald-500" : "ring-zinc-300 dark:ring-zinc-600"
        } ${readOnly ? "cursor-not-allowed" : "active:scale-90"}`}
      >
        {done ? "✓" : ""}
      </button>
      <div className="min-w-0 flex-1">
        <div className={`truncate text-sm font-semibold ${done ? "text-zinc-500 line-through" : ""}`}>
          {item.title}
        </div>
        <div className="text-xs text-zinc-500 tabular-nums">
          {item.estCost !== null ? formatINR(item.estCost) : "No cost added"}
        </div>
      </div>
      {!readOnly && (
        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            onClick={() => setEditing(true)}
            aria-label={`Edit ${item.title}`}
            className="rounded-lg px-2 py-1 text-base active:scale-90"
          >
            ✏️
          </button>
          <button
            type="button"
            onClick={onDelete}
            aria-label={`Delete ${item.title}`}
            className="rounded-lg px-2 py-1 text-base active:scale-90"
          >
            🗑️
          </button>
        </div>
      )}
    </li>
  );
}
