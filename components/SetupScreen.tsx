type Props = { kind: "missing-url" | "db-error"; message?: string };

export default function SetupScreen({ kind, message }: Props) {
  const missing = kind === "missing-url";
  return (
    <main className="safe-top safe-bottom mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-5">
      <div className="text-center">
        <div className="text-5xl">{missing ? "🔌" : "🛠️"}</div>
        <h1 className="mt-3 text-2xl font-bold">
          {missing ? "Almost there!" : "Can't reach the database"}
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          {missing
            ? "The app needs a Neon Postgres connection string to store your boxes. Tables and data are created automatically on first load — no migrations to run."
            : "The DATABASE_URL is set, but connecting or setting up the tables failed. Double-check the connection string and that the Neon project is awake."}
        </p>
      </div>

      <ol className="space-y-3 rounded-2xl bg-white p-5 text-sm shadow-sm ring-1 ring-black/5 dark:bg-zinc-900 dark:ring-white/10">
        <li>
          <b>1.</b> Create a free database at{" "}
          <span className="font-medium text-emerald-600 dark:text-emerald-400">neon.tech</span>{" "}
          (or add the Neon integration from your Vercel project&apos;s <i>Storage</i> tab).
        </li>
        <li>
          <b>2.</b> Add these environment variables in Vercel → Settings → Environment Variables:
          <pre className="mt-2 overflow-x-auto rounded-lg bg-zinc-100 p-3 text-xs dark:bg-zinc-800">
{`DATABASE_URL=postgresql://…
HUSBAND_PIN=1234
WIFE_PIN=5678`}
          </pre>
        </li>
        <li>
          <b>3.</b> Redeploy and reload this page. 🎉
        </li>
      </ol>

      {message && !missing && (
        <p className="break-words rounded-xl bg-red-50 p-3 font-mono text-xs text-red-700 dark:bg-red-950/50 dark:text-red-300">
          {message}
        </p>
      )}
    </main>
  );
}
