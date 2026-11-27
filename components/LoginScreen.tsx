"use client";

import { useActionState, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { loginAction, type LoginState } from "@/app/actions";
import { PLAYER_KEYS, PLAYERS, type Player } from "@/lib/constants";
import DefaultPinBanner from "./DefaultPinBanner";

const accent: Record<Player, string> = {
  husband: "from-sky-500 to-indigo-500",
  wife: "from-pink-500 to-rose-500",
};

export default function LoginScreen({ defaultPins }: { defaultPins: boolean }) {
  const [player, setPlayer] = useState<Player | null>(null);
  const [pin, setPin] = useState("");
  const [state, formAction, pending] = useActionState<LoginState, FormData>(loginAction, {
    error: null,
  });
  const formRef = useRef<HTMLFormElement>(null);
  const idle = useSearchParams().get("reason") === "idle";

  function onPinChange(v: string) {
    const digits = v.replace(/\D/g, "").slice(0, 4);
    setPin(digits);
    if (digits.length === 4) {
      // auto-submit once 4 digits are in
      requestAnimationFrame(() => formRef.current?.requestSubmit());
    }
  }

  return (
    <main className="safe-top safe-bottom mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-5">
      {defaultPins && <DefaultPinBanner />}
      {idle && (
        <div className="rounded-xl bg-sky-50 px-3 py-2 text-xs text-sky-800 ring-1 ring-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:ring-sky-900">
          🔒 Logged out after 5 minutes of inactivity. Enter your PIN to continue.
        </div>
      )}

      <header className="mt-6 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
          The 2027 challenge
        </p>
        <h1 className="mt-1 text-3xl font-extrabold">Husband 🆚 Wife</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          One box at a time · one goal together
        </p>
      </header>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-zinc-600 dark:text-zinc-400">Who&apos;s saving?</h2>
        <div className="grid grid-cols-2 gap-3">
          {PLAYER_KEYS.map((p) => {
            const selected = player === p;
            return (
              <button
                key={p}
                type="button"
                onClick={() => {
                  setPlayer(p);
                  setPin("");
                }}
                className={`rounded-2xl p-4 text-left transition active:scale-[0.98] ${
                  selected
                    ? `bg-gradient-to-br ${accent[p]} text-white shadow-lg`
                    : "bg-white ring-1 ring-black/5 dark:bg-zinc-900 dark:ring-white/10"
                }`}
              >
                <div className="text-3xl">{PLAYERS[p].emoji}</div>
                <div className="mt-2 text-lg font-bold">{PLAYERS[p].name}</div>
                <div className={`text-xs ${selected ? "text-white/80" : "text-zinc-500"}`}>
                  {PLAYERS[p].role}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {player && (
        <form ref={formRef} action={formAction} className="space-y-3">
          <input type="hidden" name="player" value={player} />
          <label className="block text-sm font-semibold text-zinc-600 dark:text-zinc-400" htmlFor="pin">
            {PLAYERS[player].name}&apos;s 4-digit PIN
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
        </form>
      )}
    </main>
  );
}
