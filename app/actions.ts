"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { checkPin, clearSession, getSessionPlayer, setSessionPlayer } from "@/lib/auth";
import { isPlayer, PLAYERS } from "@/lib/constants";
import { ensureDbInitialized, query } from "@/lib/db";
import type { ActionResult } from "@/lib/types";

export type LoginState = { error: string | null };

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

export async function toggleBoxAction(boxId: number, check: boolean): Promise<ActionResult> {
  const me = await getSessionPlayer();
  if (!me) return { ok: false, error: "Session expired — please log in again." };
  if (!Number.isInteger(boxId)) return { ok: false, error: "Invalid box." };

  try {
    await ensureDbInitialized();
    const rows = await query(
      `UPDATE boxes
         SET is_checked = $1::boolean,
             checked_at = CASE WHEN $1::boolean THEN NOW() ELSE NULL END
       WHERE id = $2 AND player = $3
       RETURNING id`,
      [check, boxId, me],
    );
    if (rows.length === 0) {
      return { ok: false, error: "🔒 You can't fill your partner's boxes!" };
    }
  } catch (err) {
    console.error("toggleBoxAction failed", err);
    return { ok: false, error: "Couldn't save — check your connection and try again." };
  }

  refresh();
  return { ok: true };
}

export async function updateMoneyDateAction(
  monthIndex: number,
  isCompleted: boolean,
  notes: string,
): Promise<ActionResult> {
  const me = await getSessionPlayer();
  if (!me) return { ok: false, error: "Session expired — please log in again." };
  if (!Number.isInteger(monthIndex) || monthIndex < 1 || monthIndex > 12) {
    return { ok: false, error: "Invalid month." };
  }

  try {
    await ensureDbInitialized();
    await query("UPDATE money_dates SET is_completed = $1, notes = $2 WHERE month_index = $3", [
      isCompleted,
      notes.slice(0, 280),
      monthIndex,
    ]);
  } catch (err) {
    console.error("updateMoneyDateAction failed", err);
    return { ok: false, error: "Couldn't save the Money Date — try again." };
  }

  refresh();
  return { ok: true };
}
