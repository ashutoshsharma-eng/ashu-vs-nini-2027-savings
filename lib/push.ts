import "server-only";
import { WebPushError, generateVAPIDKeys, sendNotification } from "web-push";
import { query } from "./db";

type Keys = { publicKey: string; privateKey: string };
let cached: Keys | null = null;

/** VAPID keys identify this app to Apple/Google push services. Created on first use and stored in the DB. */
export async function getVapidKeys(): Promise<Keys> {
  if (cached) return cached;
  const fresh = generateVAPIDKeys();
  await query(
    "INSERT INTO push_config (id, public_key, private_key) VALUES (1, $1, $2) ON CONFLICT (id) DO NOTHING",
    [fresh.publicKey, fresh.privateKey],
  );
  const [row] = await query<{ public_key: string; private_key: string }>(
    "SELECT public_key, private_key FROM push_config WHERE id = 1",
  );
  cached = { publicKey: row.public_key, privateKey: row.private_key };
  return cached;
}

function vapidSubject(): string {
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  return process.env.VAPID_SUBJECT?.trim() || (host ? `https://${host}` : "mailto:reminders@savings.app");
}

export type PushInput = { endpoint: string; keys: { p256dh: string; auth: string } };

export async function saveSubscription(memberId: number, sub: PushInput, userAgent: string | null) {
  // One device belongs to whoever subscribed on it most recently.
  await query(
    `INSERT INTO push_subscriptions (member_id, endpoint, p256dh, auth, user_agent)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (endpoint) DO UPDATE
       SET member_id = $1, p256dh = $3, auth = $4, user_agent = $5, created_at = NOW()`,
    [memberId, sub.endpoint, sub.keys.p256dh, sub.keys.auth, userAgent?.slice(0, 300) ?? null],
  );
}

export async function deleteSubscription(memberId: number, endpoint: string) {
  await query("DELETE FROM push_subscriptions WHERE member_id = $1 AND endpoint = $2", [memberId, endpoint]);
}

export async function subscriptionCount(memberId: number): Promise<number> {
  const [{ count }] = await query<{ count: number }>(
    "SELECT COUNT(*)::int AS count FROM push_subscriptions WHERE member_id = $1",
    [memberId],
  );
  return count;
}

export type PushMessage = { title: string; body: string; url?: string; tag?: string };

/** Sends to every device the member turned reminders on for. Returns how many deliveries succeeded. */
export async function sendToMember(memberId: number, msg: PushMessage): Promise<number> {
  const subs = await query<{ endpoint: string; p256dh: string; auth: string }>(
    "SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE member_id = $1",
    [memberId],
  );
  if (subs.length === 0) return 0;
  const { publicKey, privateKey } = await getVapidKeys();
  const payload = JSON.stringify({ url: "/", ...msg });

  let delivered = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
          { vapidDetails: { subject: vapidSubject(), publicKey, privateKey }, TTL: 6 * 60 * 60, urgency: "normal" },
        );
        delivered++;
      } catch (err) {
        // 404/410: the device unsubscribed or the app was removed — forget it.
        if (err instanceof WebPushError && (err.statusCode === 404 || err.statusCode === 410)) {
          await query("DELETE FROM push_subscriptions WHERE endpoint = $1", [s.endpoint]);
        } else {
          console.error("Push failed", err);
        }
      }
    }),
  );
  return delivered;
}
