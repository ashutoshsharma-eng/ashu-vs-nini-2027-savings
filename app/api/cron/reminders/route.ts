import { connection } from "next/server";
import { safeEqual } from "@/lib/auth";
import { ensureDbInitialized } from "@/lib/db";
import { SLOTS, runReminders, slotFor, type Slot } from "@/lib/reminders";

/**
 * Called by Vercel Cron (see vercel.json) on Friday evening, Saturday morning + evening
 * and Sunday morning (India time). Vercel sends `Authorization: Bearer $CRON_SECRET`.
 * Add `?slot=fri_eve|sat_am|sat_eve|sun_am` to trigger a specific reminder by hand.
 */
export async function GET(request: Request) {
  await connection();
  const secret = process.env.CRON_SECRET?.trim();
  const auth = request.headers.get("authorization") ?? "";
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const requested = new URL(request.url).searchParams.get("slot");
  const slot: Slot | null = SLOTS.includes(requested as Slot) ? (requested as Slot) : slotFor(new Date());
  if (!slot) return Response.json({ skipped: "Not a reminder time" });

  try {
    await ensureDbInitialized();
    return Response.json(await runReminders(slot));
  } catch (err) {
    console.error("Reminder run failed", err);
    return Response.json({ error: "Reminder run failed" }, { status: 500 });
  }
}
