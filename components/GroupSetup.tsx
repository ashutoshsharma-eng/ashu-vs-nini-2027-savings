"use client";

import { useState, useTransition } from "react";
import { setupGroupAction, type NewMemberInput } from "@/app/actions";
import { EMOJI_SUGGESTIONS, MAX_MEMBERS, colorOf, nextFreeColor } from "@/lib/members";
import MemberAvatarPicker from "./MemberAvatarPicker";

const field =
  "w-full rounded-xl bg-zinc-50 px-3 py-2.5 text-base ring-1 ring-black/10 outline-none focus:ring-2 focus:ring-emerald-500 dark:bg-zinc-800 dark:ring-white/10";

function blankMember(index: number, taken: string[]): NewMemberInput {
  return { name: "", emoji: EMOJI_SUGGESTIONS[index % EMOJI_SUGGESTIONS.length], color: nextFreeColor(taken), pin: "" };
}

export default function GroupSetup({ hasSetupCode }: { hasSetupCode: boolean }) {
  const [code, setCode] = useState("");
  const [groupName, setGroupName] = useState("");
  const [members, setMembers] = useState<NewMemberInput[]>([blankMember(0, [])]);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const update = (i: number, patch: Partial<NewMemberInput>) =>
    setMembers((ms) => ms.map((m, j) => (j === i ? { ...m, ...patch } : m)));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await setupGroupAction({ code, groupName, members });
      if (res && !res.ok) setError(res.error);
    });
  }

  const mode = members.length === 1 ? "Solo saver" : members.length === 2 ? "Duo challenge" : "Group challenge";

  if (!hasSetupCode) {
    return (
      <main className="safe-top safe-bottom mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-4 px-5 text-center">
        <div className="text-5xl">🔐</div>
        <h1 className="text-2xl font-bold">One more setting</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          To stop strangers from claiming this app, add a <code className="font-semibold">SETUP_CODE</code>{" "}
          environment variable in Vercel (any word or number you like), redeploy, and reload this page. You&apos;ll
          type it once to create your group.
        </p>
      </main>
    );
  }

  return (
    <main className="safe-top safe-bottom mx-auto w-full max-w-md flex-1 px-5">
      <form onSubmit={submit} className="space-y-5 py-6">
        <header className="text-center">
          <div className="text-5xl">🐷</div>
          <h1 className="mt-2 text-2xl font-extrabold">Start a savings challenge</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Save on your own, as a couple, or with the whole family (up to {MAX_MEMBERS}).
          </p>
        </header>

        <div className="space-y-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5 dark:bg-zinc-900 dark:ring-white/10">
          <label className="block space-y-1">
            <span className="text-sm font-semibold">Setup code</span>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              type="password"
              autoComplete="off"
              placeholder="The SETUP_CODE from Vercel"
              className={field}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-semibold">Group name</span>
            <input
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              maxLength={60}
              placeholder="e.g. Sharma Family, Husband vs Wife, My 2027 Savings"
              className={field}
            />
          </label>
        </div>

        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-600 dark:text-zinc-400">
            Who&apos;s saving? · <span className="text-emerald-600 dark:text-emerald-400">{mode}</span>
          </h2>
          <span className="text-xs text-zinc-500">
            {members.length}/{MAX_MEMBERS}
          </span>
        </div>

        {members.map((m, i) => (
          <fieldset
            key={i}
            className={`min-w-0 space-y-3 rounded-2xl bg-white p-4 shadow-sm ring-2 dark:bg-zinc-900 ${colorOf(m.color).ring}`}
          >
            <legend className="sr-only">Person {i + 1}</legend>
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold">
                {m.emoji} {i === 0 ? "You (admin)" : `Person ${i + 1}`}
              </span>
              {i > 0 && (
                <button
                  type="button"
                  onClick={() => setMembers((ms) => ms.filter((_, j) => j !== i))}
                  className="text-xs font-semibold text-red-600"
                >
                  Remove
                </button>
              )}
            </div>
            <div className="grid grid-cols-[1fr_6rem] gap-2">
              <input
                value={m.name}
                onChange={(e) => update(i, { name: e.target.value })}
                maxLength={30}
                placeholder="Name"
                aria-label={`Person ${i + 1} name`}
                className={field}
              />
              <input
                value={m.pin}
                onChange={(e) => update(i, { pin: e.target.value.replace(/\D/g, "").slice(0, 4) })}
                inputMode="numeric"
                type="password"
                autoComplete="new-password"
                placeholder="PIN"
                aria-label={`Person ${i + 1} 4-digit PIN`}
                className={`${field} text-center tracking-[0.4em]`}
              />
            </div>
            <MemberAvatarPicker
              emoji={m.emoji}
              color={m.color}
              onEmoji={(emoji) => update(i, { emoji })}
              onColor={(color) => update(i, { color })}
            />
          </fieldset>
        ))}

        {members.length < MAX_MEMBERS && (
          <button
            type="button"
            onClick={() =>
              setMembers((ms) => [...ms, blankMember(ms.length, ms.map((x) => x.color))])
            }
            className="w-full rounded-2xl border-2 border-dashed border-zinc-300 py-3 text-sm font-semibold text-zinc-600 active:scale-[0.99] dark:border-zinc-700 dark:text-zinc-300"
          >
            + Add another person
          </button>
        )}

        <p className="text-xs text-zinc-500">
          You can share each person&apos;s PIN with them — everyone can change their own PIN later in ⚙️ Settings.
          As admin you can add or remove people any time.
        </p>

        {error && (
          <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-2xl bg-emerald-600 py-3.5 font-semibold text-white active:scale-[0.99] disabled:opacity-50"
        >
          {pending ? "Creating…" : "Create group →"}
        </button>
      </form>
    </main>
  );
}
