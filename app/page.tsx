import { Suspense } from "react";
import { connection } from "next/server";
import Dashboard from "@/components/Dashboard";
import LoginScreen from "@/components/LoginScreen";
import SetupScreen from "@/components/SetupScreen";
import { getSessionPlayer, usingDefaultPins } from "@/lib/auth";
import { ensureDbInitialized, hasDatabaseUrl, loadBoxes, loadMoneyDates } from "@/lib/db";
import type { BoxRow, MoneyDateRow } from "@/lib/types";

export default function Page() {
  return (
    <Suspense fallback={<Splash />}>
      <Home />
    </Suspense>
  );
}

async function Home() {
  await connection(); // always render per-request (reads env, cookies and live DB data)

  if (!hasDatabaseUrl()) return <SetupScreen kind="missing-url" />;

  const defaultPins = usingDefaultPins();
  const me = await getSessionPlayer();
  if (!me) return <LoginScreen defaultPins={defaultPins} />;

  let data: Awaited<ReturnType<typeof loadData>> | null = null;
  let dbError: string | null = null;
  try {
    data = await loadData();
  } catch (err) {
    console.error("Database error", err);
    dbError = err instanceof Error ? err.message : String(err);
  }

  if (!data) return <SetupScreen kind="db-error" message={dbError ?? undefined} />;

  return (
    <Dashboard
      me={me}
      boxes={data.boxes}
      moneyDates={data.dates}
      defaultPins={defaultPins}
      serverNow={data.now}
    />
  );
}

async function loadData(): Promise<{ boxes: BoxRow[]; dates: MoneyDateRow[]; now: number }> {
  await ensureDbInitialized();
  const [boxes, dates] = await Promise.all([loadBoxes(), loadMoneyDates()]);
  return { boxes, dates, now: Date.now() };
}

function Splash() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
      <div className="text-5xl animate-pulse">🐷</div>
      <p className="text-sm text-zinc-500">Counting the coins…</p>
    </main>
  );
}
