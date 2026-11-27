import { Suspense } from "react";
import { connection } from "next/server";
import Dashboard from "@/components/Dashboard";
import GroupSetup from "@/components/GroupSetup";
import LoginScreen from "@/components/LoginScreen";
import SetupScreen from "@/components/SetupScreen";
import { getSessionMember, setupCode } from "@/lib/auth";
import {
  ensureDbInitialized,
  hasDatabaseUrl,
  loadBoxes,
  loadBucketItems,
  loadGroupName,
  loadMembers,
  loadMoneyDates,
  loadPlan,
} from "@/lib/db";

export default function Page() {
  return (
    <Suspense fallback={<Splash />}>
      <Home />
    </Suspense>
  );
}

type Screen =
  | { kind: "setup-db"; message?: string }
  | { kind: "group-setup"; hasSetupCode: boolean }
  | { kind: "login"; members: Awaited<ReturnType<typeof loadMembers>>; groupName: string }
  | { kind: "dashboard"; data: Awaited<ReturnType<typeof loadDashboard>> };

async function Home() {
  await connection(); // always render per-request (reads env, cookies and live DB data)

  if (!hasDatabaseUrl()) return <SetupScreen kind="missing-url" />;

  const screen = await resolveScreen();
  switch (screen.kind) {
    case "setup-db":
      return <SetupScreen kind="db-error" message={screen.message} />;
    case "group-setup":
      return <GroupSetup hasSetupCode={screen.hasSetupCode} />;
    case "login":
      return <LoginScreen members={screen.members} groupName={screen.groupName} />;
    case "dashboard": {
      const d = screen.data;
      return (
        <Dashboard
          me={d.me}
          members={d.members}
          groupName={d.groupName}
          boxes={d.boxes}
          moneyDates={d.dates}
          bucket={d.bucket}
          plan={d.plan}
          serverNow={d.now}
        />
      );
    }
  }
}

async function resolveScreen(): Promise<Screen> {
  try {
    await ensureDbInitialized();
    const members = await loadMembers();
    if (members.length === 0) return { kind: "group-setup", hasSetupCode: Boolean(setupCode()) };

    const me = await getSessionMember();
    if (!me) return { kind: "login", members, groupName: await loadGroupName() };

    return { kind: "dashboard", data: await loadDashboard(me.id) };
  } catch (err) {
    console.error("Database error", err);
    return { kind: "setup-db", message: err instanceof Error ? err.message : String(err) };
  }
}

async function loadDashboard(myId: number) {
  const [members, groupName, boxes, dates, bucket, plan] = await Promise.all([
    loadMembers(),
    loadGroupName(),
    loadBoxes(),
    loadMoneyDates(),
    loadBucketItems(),
    loadPlan(),
  ]);
  const me = members.find((m) => m.id === myId);
  if (!me) throw new Error("Your profile was removed from this group.");
  return { me, members, groupName, boxes, dates, bucket, plan, now: Date.now() };
}

function Splash() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
      <div className="text-5xl animate-pulse">🐷</div>
      <p className="text-sm text-zinc-500">Counting the coins…</p>
    </main>
  );
}
