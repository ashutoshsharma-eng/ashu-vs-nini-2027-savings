"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { checkPin, clearSession, getSessionPlayer, setSessionPlayer } from "@/lib/auth";
import { isPlayer, PLAYERS, type Player } from "@/lib/constants";
import { ensureDbInitialized, query } from "@/lib/db";
import type { ActionResult } from "@/lib/types";

export type LoginState = { error: string | null };

const EXPIRED: ActionResult = { ok: false, error: "Session expired — please log in again." };
const MAX_BUCKET_ITEMS = 50;

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const player = formData.get("player");
  const pin = String(formData.get("pin") ?? "").trim();

  if (!isPlayer(player)) return { error: "Pick who you are first." };
  if (!/^\d{4}$/.test(pin)) return { error: "PIN must be 4 digits." };

  if (!checkPin(player, pin)) {
    await new Promise((r) => setTimeout(r, 700)); // slow down guessing
    return { error: `Wrong PIN for ${PLAYERS[player].name}. Try again.` };
  }

  await setSessionPlayer(player);
  redirect("/");
}

export async function logoutAction(): Promise<void> {
  await clearSession();
  redirect("/");
}

export async function idleLogoutAction(): Promise<void> {
  await clearSession();
  redirect("/?reason=idle");
}

/** Called by the client (throttled) while the user is active, to keep the session alive. */
export async function touchSessionAction(): Promise<{ ok: boolean }> {
  const me = await getSessionPlayer();
  if (!me) return { ok: false };
  await setSessionPlayer(me);
  return { ok: true };
}

/** Resolves the logged-in player and renews their session (any action counts as activity). */
async function activePlayer(): Promise<Player | null> {
  const me = await getSessionPlayer();
  if (me) await setSessionPlayer(me);
  return me;
}

async function run(label: string, fn: () => Promise<ActionResult | void>): Promise<ActionResult> {
  try {
    await ensureDbInitialized();
    const res = await fn();
    if (res && !res.ok) return res;
  } catch (err) {
    console.error(`${label} failed`, err);
    return { ok: false, error: "Couldn't save — check your connection and try again." };
  }
  refresh();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Boxes
// ---------------------------------------------------------------------------

export async function toggleBoxAction(boxId: number, check: boolean): Promise<ActionResult> {
  const me = await activePlayer();
  if (!me) return EXPIRED;
  if (!Number.isInteger(boxId)) return { ok: false, error: "Invalid box." };

  return run("toggleBox", async () => {
    const rows = await query(
      `UPDATE boxes
         SET is_checked = $1::boolean,
             checked_at = CASE WHEN $1::boolean THEN NOW() ELSE NULL END
       WHERE id = $2 AND player = $3
       RETURNING id`,
      [check, boxId, me],
    );
    if (rows.length === 0) return { ok: false, error: "🔒 You can't fill your partner's boxes!" };
  });
}

// ---------------------------------------------------------------------------
// Sunday Money Dates (shared by both players)
// ---------------------------------------------------------------------------

export async function updateMoneyDateAction(
  weekIndex: number,
  isCompleted: boolean,
  notes: string,
): Promise<ActionResult> {
  const me = await activePlayer();
  if (!me) return EXPIRED;
  if (!Number.isInteger(weekIndex) || weekIndex < 1 || weekIndex > 53) {
    return { ok: false, error: "Invalid Sunday." };
  }

  return run("updateMoneyDate", async () => {
    await query(
      "UPDATE sunday_money_dates SET is_completed = $1, notes = $2 WHERE week_index = $3",
      [isCompleted, notes.slice(0, 280), weekIndex],
    );
  });
}

// ---------------------------------------------------------------------------
// Bucket lists (each player edits only their own)
// ---------------------------------------------------------------------------

function cleanBucketInput(title: string, estCost: number | null) {
  const t = title.trim().replace(/\s+/g, " ").slice(0, 120);
  if (!t) return { error: "Give it a name first ✍️" } as const;
  if (estCost !== null && (!Number.isFinite(estCost) || estCost < 0 || estCost > 100_000_000)) {
    return { error: "That cost doesn't look right." } as const;
  }
  return { title: t, estCost: estCost === null ? null : Math.round(estCost) } as const;
}

export async function addBucketItemAction(
  title: string,
  estCost: number | null,
): Promise<ActionResult> {
  const me = await activePlayer();
  if (!me) return EXPIRED;
  const input = cleanBucketInput(title, estCost);
  if ("error" in input) return { ok: false, error: input.error ?? "Invalid item." };

  return run("addBucketItem", async () => {
    const [{ count }] = await query<{ count: number }>(
      "SELECT COUNT(*)::int AS count FROM bucket_items WHERE player = $1",
      [me],
    );
    if (count >= MAX_BUCKET_ITEMS) {
      return { ok: false, error: `Bucket list is full (${MAX_BUCKET_ITEMS} items max).` };
    }
    await query("INSERT INTO bucket_items (player, title, est_cost) VALUES ($1, $2, $3)", [
      me,
      input.title,
      input.estCost,
    ]);
  });
}

export async function updateBucketItemAction(
  id: number,
  patch: { title: string; estCost: number | null; isDone: boolean },
): Promise<ActionResult> {
  const me = await activePlayer();
  if (!me) return EXPIRED;
  if (!Number.isInteger(id)) return { ok: false, error: "Invalid item." };
  const input = cleanBucketInput(patch.title, patch.estCost);
  if ("error" in input) return { ok: false, error: input.error ?? "Invalid item." };

  return run("updateBucketItem", async () => {
    const rows = await query(
      `UPDATE bucket_items SET title = $1, est_cost = $2, is_done = $3
        WHERE id = $4 AND player = $5 RETURNING id`,
      [input.title, input.estCost, Boolean(patch.isDone), id, me],
    );
    if (rows.length === 0) return { ok: false, error: "🔒 That's your partner's list!" };
  });
}

export async function deleteBucketItemAction(id: number): Promise<ActionResult> {
  const me = await activePlayer();
  if (!me) return EXPIRED;
  if (!Number.isInteger(id)) return { ok: false, error: "Invalid item." };

  return run("deleteBucketItem", async () => {
    const rows = await query("DELETE FROM bucket_items WHERE id = $1 AND player = $2 RETURNING id", [
      id,
      me,
    ]);
    if (rows.length === 0) return { ok: false, error: "🔒 That's your partner's list!" };
  });
}
