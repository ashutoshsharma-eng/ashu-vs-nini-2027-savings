import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { IDLE_LIMIT_MS, isPlayer, type Player } from "./constants";

export const SESSION_COOKIE = "hvw_session";
/**
 * The client logs out after IDLE_LIMIT_MS without interaction and pings the server
 * at most once a minute while active, so the server allows one extra minute of slack.
 */
const SERVER_IDLE_LIMIT_MS = IDLE_LIMIT_MS + 60_000;

const DEFAULT_PINS: Record<Player, string> = { husband: "1111", wife: "2222" };

export function getPin(player: Player): string {
  const env = player === "husband" ? process.env.HUSBAND_PIN : process.env.WIFE_PIN;
  return env?.trim() || DEFAULT_PINS[player];
}

export function usingDefaultPins(): boolean {
  return !process.env.HUSBAND_PIN?.trim() || !process.env.WIFE_PIN?.trim();
}

/**
 * Signing secret. Derived from the PINs (and DB URL) unless AUTH_SECRET is set,
 * so changing a PIN automatically signs everyone out.
 */
function secret(): string {
  return (
    process.env.AUTH_SECRET?.trim() ||
    createHash("sha256")
      .update(`${process.env.DATABASE_URL ?? ""}|${getPin("husband")}|${getPin("wife")}`)
      .digest("hex")
  );
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function checkPin(player: Player, pin: string): boolean {
  return safeEqual(pin, getPin(player));
}

/** Cookie value: `<player>.<lastActiveMs>.<hmac>`; expires after the idle limit. */
export async function getSessionPlayer(): Promise<Player | null> {
  const raw = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  const [player, ts, sig] = raw.split(".");
  if (!isPlayer(player) || !ts || !sig) return null;
  if (!safeEqual(sig, sign(`${player}.${ts}`))) return null;
  const age = Date.now() - Number(ts);
  if (!Number.isFinite(age) || age > SERVER_IDLE_LIMIT_MS) return null;
  return player;
}

/** Sets (or renews) the session with a fresh last-active timestamp. */
export async function setSessionPlayer(player: Player): Promise<void> {
  const payload = `${player}.${Date.now()}`;
  (await cookies()).set(SESSION_COOKIE, `${payload}.${sign(payload)}`, {
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
