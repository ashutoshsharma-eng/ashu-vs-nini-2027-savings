import "server-only";
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { SUNDAYS } from "./constants";
import { hashPin } from "./pin";
import { DEFAULT_PLAN, type Plan } from "./plan";
import type { BoxRow, BucketItem, Member, MoneyDateRow } from "./types";

export class MissingDatabaseUrlError extends Error {
  constructor() {
    super("DATABASE_URL is not set");
    this.name = "MissingDatabaseUrlError";
  }
}

export function hasDatabaseUrl(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

let sqlClient: NeonQueryFunction<false, false> | null = null;

function getSql(): NeonQueryFunction<false, false> {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) throw new MissingDatabaseUrlError();
  if (!sqlClient) sqlClient = neon(url);
  return sqlClient;
}

/** Run several parameterized statements atomically (one non-interactive transaction). */
export async function transaction(statements: [string, unknown[]][]): Promise<Record<string, unknown>[][]> {
  const sql = getSql();
  return (await sql.transaction(statements.map(([text, params]) => sql.query(text, params)))) as Record<
    string,
    unknown
  >[][];
}

/** Run a parameterized query and return rows. */
export async function query<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  return (await getSql().query(text, params)) as T[];
}

// ---------------------------------------------------------------------------
// Zero-touch schema + seed + migrations. Runs once per server instance;
// concurrent callers share the same in-flight promise so they never race.
// Every statement is idempotent, so running it again on a live DB is safe.
// ---------------------------------------------------------------------------

let initPromise: Promise<void> | null = null;

export function ensureDbInitialized(): Promise<void> {
  if (!initPromise) {
    initPromise = initialize().catch((err) => {
      initPromise = null; // allow a retry on the next request
      throw err;
    });
  }
  return initPromise;
}

async function initialize(): Promise<void> {
  // Was this database created by the original two-player (husband/wife) version?
  const [{ had_boxes, had_members }] = await query<{ had_boxes: boolean; had_members: boolean }>(
    "SELECT to_regclass('boxes') IS NOT NULL AS had_boxes, to_regclass('members') IS NOT NULL AS had_members",
  );

  await query(`CREATE TABLE IF NOT EXISTS group_settings (
    id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    name VARCHAR(60) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`);

  await query(`CREATE TABLE IF NOT EXISTS members (
    id SERIAL PRIMARY KEY,
    name VARCHAR(30) NOT NULL,
    emoji VARCHAR(16) NOT NULL DEFAULT '🙂',
    color VARCHAR(16) NOT NULL DEFAULT 'sky',
    pin_hash TEXT NOT NULL,
    pin_is_default BOOLEAN NOT NULL DEFAULT FALSE,
    is_admin BOOLEAN NOT NULL DEFAULT FALSE,
    legacy_key VARCHAR(20) UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`);

  await query(`CREATE TABLE IF NOT EXISTS boxes (
    id SERIAL PRIMARY KEY,
    player VARCHAR(20),
    member_id INT,
    amount INT NOT NULL,
    is_checked BOOLEAN DEFAULT FALSE,
    checked_at TIMESTAMPTZ
  )`);
  // Upgrades from the husband/wife schema: key boxes by member instead of 'husband'/'wife'.
  await query("ALTER TABLE boxes ADD COLUMN IF NOT EXISTS member_id INT");
  await query("ALTER TABLE boxes ALTER COLUMN player DROP NOT NULL");
  await query("CREATE UNIQUE INDEX IF NOT EXISTS boxes_member_amount_uq ON boxes (member_id, amount)");

  // Money Date = every Sunday of 2027 (replaces the earlier first-Sunday-only `money_dates`).
  await query(`CREATE TABLE IF NOT EXISTS sunday_money_dates (
    id SERIAL PRIMARY KEY,
    week_index INT UNIQUE NOT NULL,
    sunday_date DATE UNIQUE NOT NULL,
    is_completed BOOLEAN DEFAULT FALSE,
    notes TEXT DEFAULT ''
  )`);

  await query(`CREATE TABLE IF NOT EXISTS bucket_items (
    id SERIAL PRIMARY KEY,
    player VARCHAR(20),
    member_id INT,
    title VARCHAR(120) NOT NULL,
    est_cost INT,
    is_done BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`);
  await query("ALTER TABLE bucket_items ADD COLUMN IF NOT EXISTS member_id INT");
  await query("ALTER TABLE bucket_items ALTER COLUMN player DROP NOT NULL");

  // The shared plan (single row). Boxes are created from it when the plan is set up in the app.
  await query(`CREATE TABLE IF NOT EXISTS challenge_plan (
    id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    start_amount INT NOT NULL,
    step_amount INT NOT NULL,
    box_count INT NOT NULL,
    is_configured BOOLEAN NOT NULL DEFAULT FALSE,
    updated_by VARCHAR(20),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`);

  if (had_boxes && !had_members) await migrateFromTwoPlayerVersion();

  const [{ has_plan }] = await query<{ has_plan: boolean }>(
    "SELECT EXISTS (SELECT 1 FROM challenge_plan) AS has_plan",
  );
  if (!has_plan) {
    // Upgrading from the fixed ₹50 → ₹2,600 version?
    const [old] = await query<{ ticked: number; per_member: number; min: number | null; max: number | null }>(
      `SELECT COUNT(*) FILTER (WHERE is_checked)::int AS ticked,
              COALESCE(COUNT(*) / NULLIF(COUNT(DISTINCT member_id), 0), 0)::int AS per_member,
              MIN(amount) AS min, MAX(amount) AS max
         FROM boxes`,
    );
    if (old.ticked > 0 && old.min !== null && old.max !== null && old.per_member > 1) {
      // Progress already made: keep those boxes and lock in the plan they came from.
      const step = Math.round((old.max - old.min) / (old.per_member - 1));
      await query(
        `INSERT INTO challenge_plan (id, start_amount, step_amount, box_count, is_configured)
         VALUES (1, $1, $2, $3, TRUE) ON CONFLICT (id) DO NOTHING`,
        [old.min, step, old.per_member],
      );
    } else {
      // Nothing ticked yet: clear the auto-created boxes and let you choose a plan.
      await query("DELETE FROM boxes WHERE NOT EXISTS (SELECT 1 FROM boxes WHERE is_checked)");
      await query(
        `INSERT INTO challenge_plan (id, start_amount, step_amount, box_count, is_configured)
         VALUES (1, $1, $2, $3, FALSE) ON CONFLICT (id) DO NOTHING`,
        [DEFAULT_PLAN.start, DEFAULT_PLAN.step, DEFAULT_PLAN.count],
      );
    }
  }

  const [{ count: sundayCount }] = await query<{ count: number }>(
    "SELECT COUNT(*)::int AS count FROM sunday_money_dates",
  );
  if (sundayCount === 0) {
    await query(
      `INSERT INTO sunday_money_dates (week_index, sunday_date)
       SELECT * FROM unnest($1::int[], $2::date[])
       ON CONFLICT DO NOTHING`,
      [SUNDAYS.map((s) => s.weekIndex), SUNDAYS.map((s) => s.iso)],
    );

    // Carry over anything recorded in the old first-Sunday table, if it exists.
    const [{ exists }] = await query<{ exists: boolean }>(
      "SELECT to_regclass('money_dates') IS NOT NULL AS exists",
    );
    if (exists) {
      await query(
        `UPDATE sunday_money_dates s
            SET is_completed = COALESCE(m.is_completed, FALSE), notes = COALESCE(m.notes, '')
           FROM money_dates m
          WHERE to_char(s.sunday_date, 'Mon FMDD, YYYY') = m.sunday_date`,
      );
    }
  }
}

/**
 * The first version had two fixed players ('husband'/'wife') with PINs in env vars.
 * Turn them into members (Ashutosh = admin) with the same PINs, and re-key their data.
 */
async function migrateFromTwoPlayerVersion(): Promise<void> {
  const legacy = [
    { key: "husband", name: "Ashutosh", emoji: "🧔🏻", color: "sky", admin: true, env: process.env.HUSBAND_PIN, def: "1111" },
    { key: "wife", name: "Niharika", emoji: "👩🏻", color: "pink", admin: false, env: process.env.WIFE_PIN, def: "2222" },
  ];
  for (const m of legacy) {
    const pin = m.env?.trim() || m.def;
    await query(
      `INSERT INTO members (name, emoji, color, pin_hash, pin_is_default, is_admin, legacy_key)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (legacy_key) DO NOTHING`,
      [m.name, m.emoji, m.color, hashPin(pin), !m.env?.trim(), m.admin, m.key],
    );
  }
  await query(
    "INSERT INTO group_settings (id, name) VALUES (1, 'Husband vs Wife') ON CONFLICT (id) DO NOTHING",
  );
  await query(
    `UPDATE boxes b SET member_id = m.id FROM members m
      WHERE b.member_id IS NULL AND b.player = m.legacy_key`,
  );
  await query(
    `UPDATE bucket_items b SET member_id = m.id FROM members m
      WHERE b.member_id IS NULL AND b.player = m.legacy_key`,
  );
  await query(
    `UPDATE challenge_plan c SET updated_by = m.id::text FROM members m
      WHERE c.updated_by = m.legacy_key`,
  );
}

// ---------------------------------------------------------------------------
// Group + members
// ---------------------------------------------------------------------------

type MemberRow = {
  id: number;
  name: string;
  emoji: string;
  color: string;
  is_admin: boolean;
  pin_is_default: boolean;
  pin_hash: string;
};

const toMember = (r: MemberRow): Member => ({
  id: r.id,
  name: r.name,
  emoji: r.emoji,
  color: r.color,
  isAdmin: r.is_admin,
  pinIsDefault: r.pin_is_default,
});

export async function loadMembers(): Promise<Member[]> {
  const rows = await query<MemberRow>(
    "SELECT id, name, emoji, color, is_admin, pin_is_default, pin_hash FROM members ORDER BY id",
  );
  return rows.map(toMember);
}

/** Includes the PIN hash — server use only (login, session signing). */
export async function loadMemberWithSecret(id: number): Promise<(Member & { pinHash: string }) | null> {
  const [row] = await query<MemberRow>(
    "SELECT id, name, emoji, color, is_admin, pin_is_default, pin_hash FROM members WHERE id = $1",
    [id],
  );
  return row ? { ...toMember(row), pinHash: row.pin_hash } : null;
}

export async function loadGroupName(): Promise<string> {
  const [row] = await query<{ name: string }>("SELECT name FROM group_settings WHERE id = 1");
  return row?.name ?? "Savings Challenge";
}

export async function memberCount(): Promise<number> {
  const [{ count }] = await query<{ count: number }>("SELECT COUNT(*)::int AS count FROM members");
  return count;
}

/** Creates the boxes for one member according to the current plan (if it's been set up). */
export async function createBoxesForMember(memberId: number): Promise<void> {
  await query(
    `INSERT INTO boxes (member_id, amount)
     SELECT $1::int, p.start_amount + (g - 1) * p.step_amount
       FROM challenge_plan p CROSS JOIN LATERAL generate_series(1, p.box_count) AS g
      WHERE p.id = 1 AND p.is_configured
     ON CONFLICT (member_id, amount) DO NOTHING`,
    [memberId],
  );
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function loadBoxes(): Promise<BoxRow[]> {
  const rows = await query<{
    id: number;
    member_id: number;
    amount: number;
    is_checked: boolean | null;
    checked_at: string | Date | null;
  }>(
    `SELECT b.id, b.member_id, b.amount, b.is_checked, b.checked_at
       FROM boxes b JOIN members m ON m.id = b.member_id
      ORDER BY b.member_id, b.amount`,
  );
  return rows.map((r) => ({
    id: r.id,
    memberId: r.member_id,
    amount: r.amount,
    isChecked: Boolean(r.is_checked),
    checkedAt: r.checked_at ? new Date(r.checked_at).toISOString() : null,
  }));
}

export async function loadMoneyDates(): Promise<MoneyDateRow[]> {
  const rows = await query<{
    id: number;
    week_index: number;
    sunday_date: string;
    is_completed: boolean | null;
    notes: string | null;
  }>(
    `SELECT id, week_index, to_char(sunday_date, 'YYYY-MM-DD') AS sunday_date, is_completed, notes
       FROM sunday_money_dates ORDER BY week_index`,
  );
  return rows.map((r) => ({
    id: r.id,
    weekIndex: r.week_index,
    sundayDate: r.sunday_date,
    isCompleted: Boolean(r.is_completed),
    notes: r.notes ?? "",
  }));
}

export async function loadBucketItems(): Promise<BucketItem[]> {
  const rows = await query<{
    id: number;
    member_id: number;
    title: string;
    est_cost: number | null;
    is_done: boolean | null;
    created_at: string | Date;
  }>(
    `SELECT b.id, b.member_id, b.title, b.est_cost, b.is_done, b.created_at
       FROM bucket_items b JOIN members m ON m.id = b.member_id
      ORDER BY b.member_id, b.is_done, b.created_at`,
  );
  return rows.map((r) => ({
    id: r.id,
    memberId: r.member_id,
    title: r.title,
    estCost: r.est_cost,
    isDone: Boolean(r.is_done),
    createdAt: new Date(r.created_at).toISOString(),
  }));
}

export async function loadPlan(): Promise<Plan> {
  const [row] = await query<{
    start_amount: number;
    step_amount: number;
    box_count: number;
    is_configured: boolean;
    updated_by: string | null;
  }>("SELECT start_amount, step_amount, box_count, is_configured, updated_by FROM challenge_plan WHERE id = 1");
  if (!row) return { ...DEFAULT_PLAN, configured: false, updatedBy: null };
  const by = Number(row.updated_by);
  return {
    start: row.start_amount,
    step: row.step_amount,
    count: row.box_count,
    configured: row.is_configured,
    updatedBy: Number.isInteger(by) && by > 0 ? by : null,
  };
}

/** Replaces every member's boxes with the new plan — refused once any box has been ticked. */
export async function savePlan(start: number, step: number, count: number, by: number): Promise<boolean> {
  const noTicks = "NOT EXISTS (SELECT 1 FROM boxes WHERE is_checked)";
  const results = await transaction([
    [`DELETE FROM boxes WHERE ${noTicks}`, []],
    [
      `INSERT INTO boxes (member_id, amount)
       SELECT m.id, $1::int + (g - 1) * $2::int
         FROM members m CROSS JOIN generate_series(1, $3::int) AS g
        WHERE ${noTicks}
       ON CONFLICT (member_id, amount) DO NOTHING`,
      [start, step, count],
    ],
    [
      `UPDATE challenge_plan
          SET start_amount = $1, step_amount = $2, box_count = $3,
              is_configured = TRUE, updated_by = $4, updated_at = NOW()
        WHERE id = 1 AND ${noTicks}
       RETURNING id`,
      [start, step, count, String(by)],
    ],
  ]);
  return (results[2]?.length ?? 0) > 0;
}
