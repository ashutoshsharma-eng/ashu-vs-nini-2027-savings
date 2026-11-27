"use client";

import { useActionState, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { loginAction, type LoginState } from "@/app/actions";
import { colorOf } from "@/lib/members";
import type { Member } from "@/lib/types";

export default function LoginScreen({ members, groupName }: { members: Member[]; groupName: string }) {
  const [selected, setSelected] = useState<Member | null>(members.length === 1 ? members[0] : null);
  const [pin, setPin] = useState("");
  const [state, formAction, pending] = useActionState<LoginState, FormData>(loginAction, { error: null });
  const formRef = useRef<HTMLFormElement>(null);
  const idle = useSearchParams().get("reason") === "idle";

  function onPinChange(v: string) {
    const digits = v.replace(/\D/g, "").slice(0, 4);
    setPin(digits);
    if (digits.length === 4) requestAnimationFrame(() => formRef.current?.requestSubmit());
  }

  return (
    <main className="safe-top safe-bottom mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-5">
      {idle && (
        <div className="mt-2 rounded-xl bg-sky-50 px-3 py-2 text-xs text-sky-800 ring-1 ring-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:ring-sky-900">
          🔒 Logged out after 5 minutes of inactivity. Enter your PIN to continue.
        </div>
      )}

      <header className="mt-6 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">2027 Savings</p>
        <h1 className="mt-1 text-3xl font-extrabold">{groupName}</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">One box at a time · one goal together</p>
      </header>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-zinc-600 dark:text-zinc-400">Who&apos;s saving?</h2>
        <div className={`grid gap-3 ${members.length === 1 ? "grid-cols-1" : members.length <= 4 ? "grid-cols-2" : "grid-cols-3"}`}>
          {members.map((m) => {
            const active = selected?.id === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  setSelected(m);
                  setPin("");
                }}
                className={`rounded-2xl p-4 text-left transition active:scale-[0.98] ${
                  active
                    ? `${colorOf(m.color).solid} shadow-lg`
                    : "bg-white ring-1 ring-black/5 dark:bg-zinc-900 dark:ring-white/10"
                }`}
              >
                <div className="text-3xl">{m.emoji}</div>
                <div className="mt-2 truncate text-base font-bold">{m.name}</div>
                {m.isAdmin && (
                  <div className={`text-[10px] font-semibold uppercase ${active ? "text-white/80" : "text-zinc-500"}`}>
                    Admin
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {selected && (
        <form ref={formRef} action={formAction} className="space-y-3">
          <input type="hidden" name="memberId" value={selected.id} />
          <label className="block text-sm font-semibold text-zinc-600 dark:text-zinc-400" htmlFor="pin">
            {selected.name}&apos;s 4-digit PIN
          </label>
          <input
            id="pin"
            name="pin"
            type="password"
            inputMode="numeric"
            pattern="\d{4}"
            autoComplete="current-password"
            autoFocus
            maxLength={4}
            value={pin}
            onChange={(e) => onPinChange(e.target.value)}
            className="w-full rounded-2xl bg-white px-4 py-4 text-center text-3xl tracking-[0.8em] shadow-sm ring-1 ring-black/10 outline-none focus:ring-2 focus:ring-emerald-500 dark:bg-zinc-900 dark:ring-white/10"
            placeholder="••••"
          />
          {state.error && (
            <p role="alert" className="text-center text-sm font-medium text-red-600 dark:text-red-400">
              {state.error}
            </p>
          )}
          <button
            type="submit"
            disabled={pending || pin.length !== 4}
            className="w-full rounded-2xl bg-emerald-600 py-3.5 font-semibold text-white transition active:scale-[0.99] disabled:opacity-50"
          >
            {pending ? "Checking…" : "Let's save 💪"}
          </button>
          <p className="text-center text-xs text-zinc-500">Forgot your PIN? Ask the group admin to reset it.</p>
        </form>
      )}
    </main>
  );
}
