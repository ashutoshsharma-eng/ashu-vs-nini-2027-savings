import "server-only";
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { AMOUNTS, PLAYER_KEYS, SUNDAYS, isPlayer } from "./constants";
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

  const [{ count: boxCount }] = await query<{ count: number }>(
    "SELECT COUNT(*)::int AS count FROM boxes",
  );
  if (boxCount === 0) {
    const players = PLAYER_KEYS.flatMap((p) => AMOUNTS.map(() => p));
    const amounts = PLAYER_KEYS.flatMap(() => AMOUNTS);
    await query(
      `INSERT INTO boxes (player, amount)
       SELECT * FROM unnest($1::varchar[], $2::int[])
       ON CONFLICT (player, amount) DO NOTHING`,
      [players, amounts],
    );
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
