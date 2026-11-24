import "server-only";
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { AMOUNTS, MONEY_DATES, PLAYER_KEYS, isPlayer } from "./constants";
import type { BoxRow, MoneyDateRow } from "./types";

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
// Zero-touch schema + seed. Runs once per server instance; concurrent callers
// share the same in-flight promise so they never race each other.
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

  await query(`CREATE TABLE IF NOT EXISTS money_dates (
    id SERIAL PRIMARY KEY,
    month_index INT UNIQUE NOT NULL,
    month_label VARCHAR(20) NOT NULL,
    sunday_date VARCHAR(30) NOT NULL,
    is_completed BOOLEAN DEFAULT FALSE,
    notes TEXT DEFAULT ''
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

  const [{ count: dateCount }] = await query<{ count: number }>(
    "SELECT COUNT(*)::int AS count FROM money_dates",
  );
  if (dateCount === 0) {
    await query(
      `INSERT INTO money_dates (month_index, month_label, sunday_date)
       SELECT * FROM unnest($1::int[], $2::varchar[], $3::varchar[])
       ON CONFLICT (month_index) DO NOTHING`,
      [
        MONEY_DATES.map((d) => d.monthIndex),
        MONEY_DATES.map((d) => d.monthLabel),
        MONEY_DATES.map((d) => d.sundayDate),
      ],
    );
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
    month_index: number;
    month_label: string;
    sunday_date: string;
    is_completed: boolean | null;
    notes: string | null;
  }>(
    "SELECT id, month_index, month_label, sunday_date, is_completed, notes FROM money_dates ORDER BY month_index",
  );
  return rows.map((r) => ({
    id: r.id,
    monthIndex: r.month_index,
    monthLabel: r.month_label,
    sundayDate: r.sunday_date,
    isCompleted: Boolean(r.is_completed),
    notes: r.notes ?? "",
  }));
}
