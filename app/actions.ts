"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { clearSession, getSessionMember, safeEqual, setSessionMember, setupCode } from "@/lib/auth";
import {
  createBoxesForMember,
  ensureDbInitialized,
  loadMemberWithSecret,
  loadMembers,
  memberCount,
  query,
  savePlan,
  transaction,
} from "@/lib/db";
import {
  MAX_GROUP_NAME_LENGTH,
  MAX_MEMBERS,
  cleanEmoji,
  cleanName,
  isMemberColor,
  isValidPin,
} from "@/lib/members";
import { hashPin, verifyPin } from "@/lib/pin";
import { deleteSubscription, getVapidKeys, saveSubscription, sendToMember, type PushInput } from "@/lib/push";
import { validatePlan } from "@/lib/plan";
import type { ActionResult, Member } from "@/lib/types";

export type LoginState = { error: string | null };

const EXPIRED: ActionResult = { ok: false, error: "Session expired — please log in again." };
const ADMIN_ONLY: ActionResult = { ok: false, error: "🔒 Only the group admin can do that." };
const MAX_BUCKET_ITEMS = 50;

const fail = (error: string): ActionResult => ({ ok: false, error });
const slowDown = () => new Promise((r) => setTimeout(r, 700)); // makes PIN guessing tedious

// ---------------------------------------------------------------------------
// First-time group setup (protected by SETUP_CODE)
// ---------------------------------------------------------------------------

export type NewMemberInput = { name: string; emoji: string; color: string; pin: string };

function checkMemberInput(m: NewMemberInput, needPin = true): string | null {
  if (!cleanName(m.name)) return "Every member needs a name.";
  if (!isMemberColor(m.color)) return "Pick a colour for every member.";
  if (needPin && !isValidPin(m.pin)) return `${cleanName(m.name)}'s PIN must be 4 digits.`;
  return null;
}

function duplicateName(names: string[]): string | null {
  const seen = new Set<string>();
  for (const n of names) {
    const k = n.toLowerCase();
    if (seen.has(k)) return n;
    seen.add(k);
  }
  return null;
}

export async function setupGroupAction(input: {
  code: string;
  groupName: string;
  members: NewMemberInput[];
}): Promise<ActionResult> {
  const expected = setupCode();
  if (!expected) return fail("Add a SETUP_CODE environment variable in Vercel first, then redeploy.");
  if (!safeEqual(input.code.trim(), expected)) {
    await slowDown();
    return fail("That setup code isn't right.");
  }
  const groupName = cleanName(input.groupName, MAX_GROUP_NAME_LENGTH);
  if (!groupName) return fail("Give your group a name.");
  if (input.members.length < 1) return fail("Add at least one person.");
  if (input.members.length > MAX_MEMBERS) return fail(`Up to ${MAX_MEMBERS} people can join.`);
  for (const m of input.members) {
    const err = checkMemberInput(m);
    if (err) return fail(err);
  }
  const dup = duplicateName(input.members.map((m) => cleanName(m.name)));
  if (dup) return fail(`Two people are called “${dup}” — make the names different.`);

  await ensureDbInitialized();
  if ((await memberCount()) > 0) return fail("This app is already set up — log in instead.");

  const results = await transaction([
    ["INSERT INTO group_settings (id, name) VALUES (1, $1) ON CONFLICT (id) DO UPDATE SET name = $1", [groupName]],
    [
      `INSERT INTO members (name, emoji, color, pin_hash, is_admin)
       SELECT n, e, c, h, ord = 1
         FROM unnest($1::varchar[], $2::varchar[], $3::varchar[], $4::text[]) WITH ORDINALITY AS t(n, e, c, h, ord)
        WHERE NOT EXISTS (SELECT 1 FROM members)
        ORDER BY ord
       RETURNING id`,
      [
        input.members.map((m) => cleanName(m.name)),
        input.members.map((m) => cleanEmoji(m.emoji)),
        input.members.map((m) => m.color),
        input.members.map((m) => hashPin(m.pin)),
      ],
    ],
  ]);
  const ids = (results[1] ?? []).map((r) => Number(r.id)).sort((a, b) => a - b);
  if (ids.length === 0) return fail("This app is already set up — log in instead.");

  await setSessionMember(ids[0]);
  redirect("/");
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const memberId = Number(formData.get("memberId"));
  const pin = String(formData.get("pin") ?? "").trim();

  if (!Number.isInteger(memberId) || memberId < 1) return { error: "Pick who you are first." };
  if (!isValidPin(pin)) return { error: "PIN must be 4 digits." };

  await ensureDbInitialized();
  const member = await loadMemberWithSecret(memberId);
  if (!member || !verifyPin(pin, member.pinHash)) {
    await slowDown();
    return { error: `Wrong PIN${member ? ` for ${member.name}` : ""}. Try again.` };
  }

  await setSessionMember(memberId);
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
  const me = await getSessionMember();
  if (!me) return { ok: false };
  await setSessionMember(me.id);
  return { ok: true };
}

/** Resolves the logged-in member and renews their session (any action counts as activity). */
async function activeMember(): Promise<Member | null> {
  const me = await getSessionMember();
  if (me) await setSessionMember(me.id);
  return me;
}

async function run(label: string, fn: () => Promise<ActionResult | void>): Promise<ActionResult> {
  try {
    await ensureDbInitialized();
    const res = await fn();
    if (res && !res.ok) return res;
  } catch (err) {
    console.error(`${label} failed`, err);
    return fail("Couldn't save — check your connection and try again.");
  }
  refresh();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Shared savings plan (editable by anyone until the first box is ticked)
// ---------------------------------------------------------------------------

export async function savePlanAction(start: number, step: number, count: number): Promise<ActionResult> {
  const me = await activeMember();
  if (!me) return EXPIRED;
  const invalid = validatePlan(start, step, count);
  if (invalid) return fail(invalid);

  return run("savePlan", async () => {
    const saved = await savePlan(start, step, count, me.id);
    if (!saved) return fail("🔒 The plan is locked — a box has already been ticked.");
  });
}

// ---------------------------------------------------------------------------
// Boxes
// ---------------------------------------------------------------------------

export async function toggleBoxAction(boxId: number, check: boolean): Promise<ActionResult> {
  const me = await activeMember();
  if (!me) return EXPIRED;
  if (!Number.isInteger(boxId)) return fail("Invalid box.");

  return run("toggleBox", async () => {
    const rows = await query(
      `UPDATE boxes
         SET is_checked = $1::boolean,
             checked_at = CASE WHEN $1::boolean THEN NOW() ELSE NULL END
       WHERE id = $2 AND member_id = $3
       RETURNING id`,
      [check, boxId, me.id],
    );
    if (rows.length === 0) return fail("🔒 You can only tick your own boxes!");
  });
}

// ---------------------------------------------------------------------------
// Sunday Money Dates (shared by everyone)
// ---------------------------------------------------------------------------

export async function updateMoneyDateAction(
  weekIndex: number,
  isCompleted: boolean,
  notes: string,
): Promise<ActionResult> {
  const me = await activeMember();
  if (!me) return EXPIRED;
  if (!Number.isInteger(weekIndex) || weekIndex < 1 || weekIndex > 53) return fail("Invalid Sunday.");

  return run("updateMoneyDate", async () => {
    await query(
      "UPDATE sunday_money_dates SET is_completed = $1, notes = $2 WHERE week_index = $3",
      [isCompleted, notes.slice(0, 280), weekIndex],
    );
  });
}

// ---------------------------------------------------------------------------
// Bucket lists (each member edits only their own)
// ---------------------------------------------------------------------------

function cleanBucketInput(title: string, estCost: number | null) {
  const t = title.trim().replace(/\s+/g, " ").slice(0, 120);
  if (!t) return { error: "Give it a name first ✍️" } as const;
  if (estCost !== null && (!Number.isFinite(estCost) || estCost < 0 || estCost > 100_000_000)) {
    return { error: "That cost doesn't look right." } as const;
  }
  return { title: t, estCost: estCost === null ? null : Math.round(estCost) } as const;
}

export async function addBucketItemAction(title: string, estCost: number | null): Promise<ActionResult> {
  const me = await activeMember();
  if (!me) return EXPIRED;
  const input = cleanBucketInput(title, estCost);
  if ("error" in input) return fail(input.error ?? "Invalid item.");

  return run("addBucketItem", async () => {
    const [{ count }] = await query<{ count: number }>(
      "SELECT COUNT(*)::int AS count FROM bucket_items WHERE member_id = $1",
      [me.id],
    );
    if (count >= MAX_BUCKET_ITEMS) return fail(`Bucket list is full (${MAX_BUCKET_ITEMS} items max).`);
    await query("INSERT INTO bucket_items (member_id, title, est_cost) VALUES ($1, $2, $3)", [
      me.id,
      input.title,
      input.estCost,
    ]);
  });
}

export async function updateBucketItemAction(
  id: number,
  patch: { title: string; estCost: number | null; isDone: boolean },
): Promise<ActionResult> {
  const me = await activeMember();
  if (!me) return EXPIRED;
  if (!Number.isInteger(id)) return fail("Invalid item.");
  const input = cleanBucketInput(patch.title, patch.estCost);
  if ("error" in input) return fail(input.error ?? "Invalid item.");

  return run("updateBucketItem", async () => {
    const rows = await query(
      `UPDATE bucket_items SET title = $1, est_cost = $2, is_done = $3
        WHERE id = $4 AND member_id = $5 RETURNING id`,
      [input.title, input.estCost, Boolean(patch.isDone), id, me.id],
    );
    if (rows.length === 0) return fail("🔒 That's someone else's list!");
  });
}

export async function deleteBucketItemAction(id: number): Promise<ActionResult> {
  const me = await activeMember();
  if (!me) return EXPIRED;
  if (!Number.isInteger(id)) return fail("Invalid item.");

  return run("deleteBucketItem", async () => {
    const rows = await query("DELETE FROM bucket_items WHERE id = $1 AND member_id = $2 RETURNING id", [
      id,
      me.id,
    ]);
    if (rows.length === 0) return fail("🔒 That's someone else's list!");
  });
}

// ---------------------------------------------------------------------------
// Settings — your own profile & PIN
// ---------------------------------------------------------------------------

export async function changeMyPinAction(currentPin: string, newPin: string): Promise<ActionResult> {
  const me = await activeMember();
  if (!me) return EXPIRED;
  if (!isValidPin(newPin)) return fail("New PIN must be 4 digits.");
  const full = await loadMemberWithSecret(me.id);
  if (!full || !verifyPin(currentPin, full.pinHash)) {
    await slowDown();
    return fail("Your current PIN isn't right.");
  }

  return run("changeMyPin", async () => {
    await query("UPDATE members SET pin_hash = $1, pin_is_default = FALSE WHERE id = $2", [
      hashPin(newPin),
      me.id,
    ]);
    await setSessionMember(me.id); // re-sign with the new PIN so you stay logged in
  });
}

/** Anyone can update their own name/emoji/colour; the admin can update anyone's. */
export async function updateMemberAction(
  id: number,
  patch: { name: string; emoji: string; color: string },
): Promise<ActionResult> {
  const me = await activeMember();
  if (!me) return EXPIRED;
  if (id !== me.id && !me.isAdmin) return ADMIN_ONLY;
  const err = checkMemberInput({ ...patch, pin: "" }, false);
  if (err) return fail(err);
  const name = cleanName(patch.name);

  return run("updateMember", async () => {
    const others = (await loadMembers()).filter((m) => m.id !== id).map((m) => m.name);
    if (duplicateName([...others, name])) return fail(`Someone is already called “${name}”.`);
    const rows = await query("UPDATE members SET name = $1, emoji = $2, color = $3 WHERE id = $4 RETURNING id", [
      name,
      cleanEmoji(patch.emoji),
      patch.color,
      id,
    ]);
    if (rows.length === 0) return fail("That member no longer exists.");
  });
}

// ---------------------------------------------------------------------------
// Settings — admin only
// ---------------------------------------------------------------------------

async function activeAdmin(): Promise<Member | ActionResult> {
  const me = await activeMember();
  if (!me) return EXPIRED;
  if (!me.isAdmin) return ADMIN_ONLY;
  return me;
}

const isResult = (v: Member | ActionResult): v is ActionResult => "ok" in v;

export async function renameGroupAction(name: string): Promise<ActionResult> {
  const admin = await activeAdmin();
  if (isResult(admin)) return admin;
  const clean = cleanName(name, MAX_GROUP_NAME_LENGTH);
  if (!clean) return fail("Give your group a name.");
  return run("renameGroup", async () => {
    await query(
      "INSERT INTO group_settings (id, name) VALUES (1, $1) ON CONFLICT (id) DO UPDATE SET name = $1",
      [clean],
    );
  });
}

export async function addMemberAction(input: NewMemberInput): Promise<ActionResult> {
  const admin = await activeAdmin();
  if (isResult(admin)) return admin;
  const err = checkMemberInput(input);
  if (err) return fail(err);
  const name = cleanName(input.name);

  return run("addMember", async () => {
    const existing = await loadMembers();
    if (existing.length >= MAX_MEMBERS) return fail(`Up to ${MAX_MEMBERS} people can join.`);
    if (duplicateName([...existing.map((m) => m.name), name])) return fail(`Someone is already called “${name}”.`);
    const [row] = await query<{ id: number }>(
      "INSERT INTO members (name, emoji, color, pin_hash) VALUES ($1, $2, $3, $4) RETURNING id",
      [name, cleanEmoji(input.emoji), input.color, hashPin(input.pin)],
    );
    await createBoxesForMember(row.id);
  });
}

export async function resetMemberPinAction(id: number, pin: string): Promise<ActionResult> {
  const admin = await activeAdmin();
  if (isResult(admin)) return admin;
  if (!isValidPin(pin)) return fail("PIN must be 4 digits.");
  return run("resetMemberPin", async () => {
    await query("UPDATE members SET pin_hash = $1, pin_is_default = FALSE WHERE id = $2", [hashPin(pin), id]);
    if (id === admin.id) await setSessionMember(admin.id);
  });
}

export async function makeAdminAction(id: number): Promise<ActionResult> {
  const admin = await activeAdmin();
  if (isResult(admin)) return admin;
  if (id === admin.id) return fail("You're already the admin.");
  return run("makeAdmin", async () => {
    const results = await transaction([
      ["UPDATE members SET is_admin = TRUE WHERE id = $1 RETURNING id", [id]],
      ["UPDATE members SET is_admin = FALSE WHERE id = $1 AND EXISTS (SELECT 1 FROM members WHERE id = $2)", [admin.id, id]],
    ]);
    if ((results[0]?.length ?? 0) === 0) return fail("That member no longer exists.");
  });
}

/** Removes a member together with their boxes and bucket list. */
export async function removeMemberAction(id: number): Promise<ActionResult> {
  const admin = await activeAdmin();
  if (isResult(admin)) return admin;
  if (id === admin.id) return fail("Hand the admin role to someone else before removing yourself.");
  return run("removeMember", async () => {
    await transaction([
      ["DELETE FROM boxes WHERE member_id = $1", [id]],
      ["DELETE FROM bucket_items WHERE member_id = $1", [id]],
      ["DELETE FROM members WHERE id = $1 AND NOT is_admin", [id]],
    ]);
  });
}

// ---------------------------------------------------------------------------
// Phone reminders (web push)
// ---------------------------------------------------------------------------

export async function getPushPublicKeyAction(): Promise<string | null> {
  const me = await getSessionMember();
  if (!me) return null;
  await ensureDbInitialized();
  return (await getVapidKeys()).publicKey;
}

function isPushInput(v: unknown): v is PushInput {
  const s = v as PushInput;
  return (
    typeof s?.endpoint === "string" &&
    /^https:\/\//.test(s.endpoint) &&
    s.endpoint.length < 1000 &&
    typeof s.keys?.p256dh === "string" &&
    typeof s.keys?.auth === "string"
  );
}

export async function enableRemindersAction(sub: unknown): Promise<ActionResult> {
  const me = await activeMember();
  if (!me) return EXPIRED;
  if (!isPushInput(sub)) return fail("This phone didn't give a valid notification subscription.");
  try {
    await ensureDbInitialized();
    await saveSubscription(me.id, sub, (await headers()).get("user-agent"));
    return { ok: true };
  } catch (err) {
    console.error("enableReminders failed", err);
    return fail("Couldn't turn on reminders — try again.");
  }
}

export async function disableRemindersAction(endpoint: string): Promise<ActionResult> {
  const me = await activeMember();
  if (!me) return EXPIRED;
  try {
    await ensureDbInitialized();
    await deleteSubscription(me.id, endpoint);
    return { ok: true };
  } catch (err) {
    console.error("disableReminders failed", err);
    return fail("Couldn't turn off reminders — try again.");
  }
}

export async function sendTestReminderAction(): Promise<ActionResult> {
  const me = await activeMember();
  if (!me) return EXPIRED;
  await ensureDbInitialized();
  const n = await sendToMember(me.id, {
    title: "Reminders are on 🔔",
    body: `Hi ${me.name}! If you haven't ticked a box by Friday evening, you'll get a nudge before Sunday.`,
    tag: "test",
  });
  return n > 0 ? { ok: true } : fail("No phone is set up for reminders yet — turn them on first.");
}
