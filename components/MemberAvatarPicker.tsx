"use client";

import { COLOR_KEYS, EMOJI_SUGGESTIONS, MEMBER_COLORS, type MemberColor } from "@/lib/members";

/** Emoji + colour chooser used in group setup and settings. */
export default function MemberAvatarPicker({
  emoji,
  color,
  onEmoji,
  onColor,
}: {
  emoji: string;
  color: string;
  onEmoji: (e: string) => void;
  onColor: (c: MemberColor) => void;
}) {
  return (
    <div className="min-w-0 space-y-2">
      <div className="flex gap-1 overflow-x-auto pb-1" role="radiogroup" aria-label="Avatar">
        {EMOJI_SUGGESTIONS.map((e) => (
          <button
            key={e}
            type="button"
            role="radio"
            aria-checked={emoji === e}
            onClick={() => onEmoji(e)}
            className={`h-9 w-9 shrink-0 rounded-full text-xl transition ${
              emoji === e ? "bg-zinc-900/10 ring-2 ring-emerald-500 dark:bg-white/10" : ""
            }`}
          >
            {e}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Colour">
        {COLOR_KEYS.map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={color === c}
            aria-label={MEMBER_COLORS[c].label}
            onClick={() => onColor(c)}
            className={`h-7 w-7 rounded-full ${MEMBER_COLORS[c].bar} transition ${
              color === c ? "ring-2 ring-zinc-900 ring-offset-2 dark:ring-white dark:ring-offset-zinc-900" : ""
            }`}
          />
        ))}
      </div>
    </div>
  );
}
