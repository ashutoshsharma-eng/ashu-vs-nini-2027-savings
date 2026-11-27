import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { IDLE_LIMIT_MS } from "./constants";
import { ensureDbInitialized, loadMemberWithSecret } from "./db";
import type { Member } from "./types";

export const SESSION_COOKIE = "hvw_session";
/**
 * The client logs out after IDLE_LIMIT_MS without interaction and pings the server
 * at most once a minute while active, so the server allows one extra minute of slack.
 */
const SERVER_IDLE_LIMIT_MS = IDLE_LIMIT_MS + 60_000;

/** Required to create a brand-new group, so a stranger who finds the URL can't claim it. */
export function setupCode(): string | null {
  return process.env.SETUP_CODE?.trim() || null;
}

function secret(): string {
  return (
    process.env.AUTH_SECRET?.trim() ||
    createHash("sha256").update(`hvw|${process.env.DATABASE_URL ?? ""}`).digest("hex")
  );
}

/**
 * The member's PIN hash is part of what's signed, so changing or resetting a PIN
 * signs that member out everywhere.
 */
function sign(payload: string, pinHash: string): string {
  return createHmac("sha256", secret()).update(`${payload}|${pinHash}`).digest("base64url");
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** Cookie value: `<memberId>.<lastActiveMs>.<hmac>`; expires after the idle limit. */
export async function getSessionMember(): Promise<Member | null> {
  const raw = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  const [idText, ts, sig] = raw.split(".");
  const id = Number(idText);
  if (!Number.isInteger(id) || !ts || !sig) return null;
  const age = Date.now() - Number(ts);
  if (!Number.isFinite(age) || age > SERVER_IDLE_LIMIT_MS) return null;

  await ensureDbInitialized();
  const member = await loadMemberWithSecret(id);
  if (!member || !safeEqual(sig, sign(`${id}.${ts}`, member.pinHash))) return null;
  const { pinHash: _omit, ...rest } = member;
  void _omit;
  return rest;
}

/** Sets (or renews) the session with a fresh last-active timestamp. */
export async function setSessionMember(memberId: number): Promise<void> {
  const member = await loadMemberWithSecret(memberId);
  if (!member) return;
  const payload = `${memberId}.${Date.now()}`;
  (await cookies()).set(SESSION_COOKIE, `${payload}.${sign(payload, member.pinHash)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    // The cookie itself is short-lived too; activity keeps renewing it.
    maxAge: Math.ceil(SERVER_IDLE_LIMIT_MS / 1000),
  });
}

export async function clearSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}
