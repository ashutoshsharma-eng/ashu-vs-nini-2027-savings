import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { isPlayer, type Player } from "./constants";

export const SESSION_COOKIE = "hvw_session";
const ONE_YEAR = 60 * 60 * 24 * 365;

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

function sign(player: Player): string {
  return createHmac("sha256", secret()).update(player).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function checkPin(player: Player, pin: string): boolean {
  return safeEqual(pin, getPin(player));
}

export async function getSessionPlayer(): Promise<Player | null> {
  const raw = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  const [player, sig] = raw.split(".");
  if (!isPlayer(player) || !sig) return null;
  return safeEqual(sig, sign(player)) ? player : null;
}

export async function setSessionPlayer(player: Player): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, `${player}.${sign(player)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ONE_YEAR,
  });
}

export async function clearSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}
