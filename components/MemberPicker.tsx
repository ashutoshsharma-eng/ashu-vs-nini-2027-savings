"use client";

import { colorOf } from "@/lib/members";
import type { Member } from "@/lib/types";

/** "Whose grid/list am I looking at?" — you first, then everyone else. Hidden when saving solo. */
export default function MemberPicker({
  me,
  members,
  viewing,
  onChange,
  mineLabel,
}: {
  me: Member;
  members: Member[];
  viewing: number;
  onChange: (id: number) => void;
  mineLabel: string;
}) {
  if (members.length < 2) return null;
  const ordered = [me, ...members.filter((m) => m.id !== me.id)];
  const twoUp = members.length === 2;

  return (
    <div className={twoUp ? "grid grid-cols-2 gap-2" : "-mx-4 flex gap-2 overflow-x-auto px-4 pb-1"}>
      {ordered.map((m) => {
        const active = viewing === m.id;
        return (
          <button
            key={m.id}
            type="button"
            onClick={() => onChange(m.id)}
            aria-pressed={active}
            className={`shrink-0 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-semibold transition ${
              active ? colorOf(m.color).solid : "bg-white ring-1 ring-black/10 dark:bg-zinc-900 dark:ring-white/10"
            }`}
          >
            {m.id === me.id ? mineLabel : `${m.emoji} ${m.name} 🔒`}
          </button>
        );
      })}
    </div>
  );
}
