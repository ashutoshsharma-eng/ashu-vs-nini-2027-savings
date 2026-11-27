import "server-only";
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { PLAYER_KEYS, SUNDAYS, isPlayer } from "./constants";
import { DEFAULT_PLAN, type Plan } from "./plan";
import type { BoxRow, BucketItem, MoneyDateRow } from "./types";

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
  await query(`CREATE TABLE IF NOT EXISTS boxes (
    id SERIAL PRIMARY KEY,
    player VARCHAR(20) NOT NULL,
    amount INT NOT NULL,
    is_checked BOOLEAN DEFAULT FALSE,
    checked_at TIMESTAMPTZ,
    UNIQUE(player, amount)
  )`);

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
    player VARCHAR(20) NOT NULL,
    title VARCHAR(120) NOT NULL,
    est_cost INT,
    is_done BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`);

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

  const [{ has_plan }] = await query<{ has_plan: boolean }>(
    "SELECT EXISTS (SELECT 1 FROM challenge_plan) AS has_plan",
  );
  if (!has_plan) {
    // Upgrading from the fixed ₹50 → ₹2,600 version?
    const [old] = await query<{ ticked: number; per_player: number; min: number | null; max: number | null }>(
      `SELECT COUNT(*) FILTER (WHERE is_checked)::int AS ticked,
              (COUNT(*) / 2)::int AS per_player, MIN(amount) AS min, MAX(amount) AS max
         FROM boxes`,
    );
    if (old.ticked > 0 && old.min !== null && old.max !== null && old.per_player > 1) {
      // Progress already made: keep those boxes and lock in the plan they came from.
      const step = Math.round((old.max - old.min) / (old.per_player - 1));
      await query(
        `INSERT INTO challenge_plan (id, start_amount, step_amount, box_count, is_configured)
         VALUES (1, $1, $2, $3, TRUE) ON CONFLICT (id) DO NOTHING`,
        [old.min, step, old.per_player],
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

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function loadBoxes(): Promise<BoxRow[]> {
  const rows = await query<{
    id: number;
    player: string;
    amount: number;
    is_checked: boolean | null;
    checked_at: string | Date | null;
  }>("SELECT id, player, amount, is_checked, checked_at FROM boxes ORDER BY player, amount");

  return rows
    .filter((r) => isPlayer(r.player))
    .map((r) => ({
      id: r.id,
      player: r.player as BoxRow["player"],
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
    player: string;
    title: string;
    est_cost: number | null;
    is_done: boolean | null;
    created_at: string | Date;
  }>(
    "SELECT id, player, title, est_cost, is_done, created_at FROM bucket_items ORDER BY player, is_done, created_at",
  );
  return rows
    .filter((r) => isPlayer(r.player))
    .map((r) => ({
      id: r.id,
      player: r.player as BucketItem["player"],
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
  return {
    start: row.start_amount,
    step: row.step_amount,
    count: row.box_count,
    configured: row.is_configured,
    updatedBy: isPlayer(row.updated_by) ? row.updated_by : null,
  };
}

/** Replaces all boxes with the new plan — refused once any box has been ticked. */
export async function savePlan(start: number, step: number, count: number, by: string): Promise<boolean> {
  const noTicks = "NOT EXISTS (SELECT 1 FROM boxes WHERE is_checked)";
  const results = await transaction([
    [`DELETE FROM boxes WHERE ${noTicks}`, []],
    [
      `INSERT INTO boxes (player, amount)
       SELECT p, $1::int + (g - 1) * $2::int
         FROM unnest($4::varchar[]) AS p CROSS JOIN generate_series(1, $3::int) AS g
        WHERE ${noTicks}
       ON CONFLICT (player, amount) DO NOTHING`,
      [start, step, count, PLAYER_KEYS],
    ],
    [
      `UPDATE challenge_plan
          SET start_amount = $1, step_amount = $2, box_count = $3,
              is_configured = TRUE, updated_by = $4, updated_at = NOW()
        WHERE id = 1 AND ${noTicks}
       RETURNING id`,
      [start, step, count, by],
    ],
  ]);
  return (results[2]?.length ?? 0) > 0;
}
