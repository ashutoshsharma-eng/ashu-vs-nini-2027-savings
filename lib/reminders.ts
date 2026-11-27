import "server-only";
import { formatINR } from "./constants";
import { query } from "./db";
import { sendToMember } from "./push";

/** Reminder moments before each Sunday (all India time). */
export type Slot = "fri_eve" | "sat_am" | "sat_eve" | "sun_am";
export const SLOTS: Slot[] = ["fri_eve", "sat_am", "sat_eve", "sun_am"];

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const DAY_MS = 86_400_000;

/** Day of week (0 = Sun) and hour in India for a given instant. */
function istParts(now: Date) {
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  return { day: ist.getUTCDay(), hour: ist.getUTCHours(), ymd: ist.toISOString().slice(0, 10) };
}

/** Which reminder a scheduled run at this moment stands for (null outside Fri evening → Sun). */
export function slotFor(now: Date): Slot | null {
  const { day, hour } = istParts(now);
  if (day === 5 && hour >= 15) return "fri_eve";
  if (day === 6) return hour < 15 ? "sat_am" : "sat_eve";
  if (day === 0 && hour < 15) return "sun_am";
  return null;
}

/** The coming Sunday (today if it's Sunday), as YYYY-MM-DD in India time. */
export function upcomingSunday(now: Date): string {
  const { day, ymd } = istParts(now);
  const d = new Date(`${ymd}T00:00:00Z`);
  return new Date(d.getTime() + ((7 - day) % 7) * DAY_MS).toISOString().slice(0, 10);
}

function message(slot: Slot, name: string, groupSize: number, smallest: number | null) {
  const solo = groupSize === 1;
  const easy = smallest ? ` Your smallest open box is ${formatINR(smallest)}.` : "";
  switch (slot) {
    case "fri_eve":
      return {
        title: "Sunday's coming 🗓️",
        body: `${name}, you haven't ticked a box this week yet.${easy} Easy win this weekend!`,
      };
    case "sat_am":
      return { title: "Weekend nudge ☀️", body: `Still no box ticked this week, ${name}.${easy} Even a small one counts.` };
    case "sat_eve":
      return solo
        ? { title: "Sunday check-in is tomorrow 🗓️", body: `No box ticked this week yet — tick one tonight?${easy}` }
        : {
            title: "Money Date is tomorrow ☕",
            body: `No box ticked this week yet, ${name} — fewest ticks buys the chai!${easy}`,
          };
    case "sun_am":
      return solo
        ? { title: "It's Sunday 💰", body: `Tick a box before your Sunday check-in.${easy}` }
        : { title: "It's Money Date Sunday ☕", body: `Last chance, ${name} — tick a box so you're not the one buying chai!${easy}` };
  }
}

export type ReminderReport = { slot: Slot; sunday: string; sent: string[]; skipped: string[] };

/**
 * Reminds everyone (with reminders on) who hasn't ticked a box since last Sunday.
 * Each person gets each slot at most once per week, even if the job runs twice.
 */
export async function runReminders(slot: Slot, now = new Date()): Promise<ReminderReport> {
  const sunday = upcomingSunday(now);
  const report: ReminderReport = { slot, sunday, sent: [], skipped: [] };

  const [plan] = await query<{ is_configured: boolean }>("SELECT is_configured FROM challenge_plan WHERE id = 1");
  if (!plan?.is_configured) return report;

  // "This week" = after the end of the previous Sunday (India time) up to now.
  const weekStart = new Date(new Date(`${sunday}T23:59:59.999+05:30`).getTime() - 7 * DAY_MS);

  const rows = await query<{
    id: number;
    name: string;
    ticks_this_week: number;
    open_boxes: number;
    smallest_open: number | null;
    group_size: number;
  }>(
    `SELECT m.id, m.name,
            COUNT(b.id) FILTER (WHERE b.is_checked AND b.checked_at > $1)::int AS ticks_this_week,
            COUNT(b.id) FILTER (WHERE NOT COALESCE(b.is_checked, FALSE))::int AS open_boxes,
            MIN(b.amount) FILTER (WHERE NOT COALESCE(b.is_checked, FALSE)) AS smallest_open,
            (SELECT COUNT(*)::int FROM members) AS group_size
       FROM members m
       LEFT JOIN boxes b ON b.member_id = m.id
      WHERE EXISTS (SELECT 1 FROM push_subscriptions s WHERE s.member_id = m.id)
      GROUP BY m.id, m.name`,
    [weekStart.toISOString()],
  );

  for (const r of rows) {
    if (r.ticks_this_week > 0 || r.open_boxes === 0) {
      report.skipped.push(r.name);
      continue;
    }
    // Claim this (person, week, slot) first so a repeated run can't double-send.
    const claimed = await query(
      `INSERT INTO reminder_log (member_id, sunday_date, slot) VALUES ($1, $2, $3)
       ON CONFLICT DO NOTHING RETURNING member_id`,
      [r.id, sunday, slot],
    );
    if (claimed.length === 0) {
      report.skipped.push(r.name);
      continue;
    }
    let delivered = 0;
    try {
      delivered = await sendToMember(r.id, { ...message(slot, r.name, r.group_size, r.smallest_open), tag: `sunday-${sunday}` });
    } catch (err) {
      console.error(`Reminder to ${r.name} failed`, err);
    }
    // Nothing reached them: release the claim so the next run can try again.
    if (delivered > 0) report.sent.push(r.name);
    else {
      await query("DELETE FROM reminder_log WHERE member_id = $1 AND sunday_date = $2 AND slot = $3", [r.id, sunday, slot]);
      report.skipped.push(r.name);
    }
  }
  return report;
}
