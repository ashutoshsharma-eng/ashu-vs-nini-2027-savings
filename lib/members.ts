/** Shared (client + server) helpers for group members. */

export const MAX_MEMBERS = 8;
export const MAX_NAME_LENGTH = 30;
export const MAX_GROUP_NAME_LENGTH = 60;

export const EMOJI_SUGGESTIONS = [
  "🧔🏻", "👩🏻", "👨🏻", "👧🏻", "👦🏻", "👵🏻", "👴🏻", "🧑🏻",
  "🦁", "🐼", "🦊", "🐯", "🐨", "🦄", "🐻", "🐧",
];

/** Every class name here is a complete literal so Tailwind keeps it. */
export const MEMBER_COLORS = {
  sky: {
    label: "Blue",
    solid: "bg-sky-500 text-white",
    bar: "bg-sky-500",
    checked: "bg-sky-500 text-white ring-sky-600 dark:bg-sky-600",
    ring: "ring-sky-500/50",
    text: "text-sky-600 dark:text-sky-400",
    hex: "0284C7",
    lightHex: "E0F2FE",
  },
  pink: {
    label: "Pink",
    solid: "bg-pink-500 text-white",
    bar: "bg-pink-500",
    checked: "bg-pink-500 text-white ring-pink-600 dark:bg-pink-600",
    ring: "ring-pink-500/50",
    text: "text-pink-600 dark:text-pink-400",
    hex: "DB2777",
    lightHex: "FCE7F3",
  },
  emerald: {
    label: "Green",
    solid: "bg-emerald-500 text-white",
    bar: "bg-emerald-500",
    checked: "bg-emerald-500 text-white ring-emerald-600 dark:bg-emerald-600",
    ring: "ring-emerald-500/50",
    text: "text-emerald-600 dark:text-emerald-400",
    hex: "059669",
    lightHex: "D1FAE5",
  },
  amber: {
    label: "Amber",
    solid: "bg-amber-500 text-white",
    bar: "bg-amber-500",
    checked: "bg-amber-500 text-white ring-amber-600 dark:bg-amber-600",
    ring: "ring-amber-500/50",
    text: "text-amber-600 dark:text-amber-400",
    hex: "D97706",
    lightHex: "FEF3C7",
  },
  violet: {
    label: "Purple",
    solid: "bg-violet-500 text-white",
    bar: "bg-violet-500",
    checked: "bg-violet-500 text-white ring-violet-600 dark:bg-violet-600",
    ring: "ring-violet-500/50",
    text: "text-violet-600 dark:text-violet-400",
    hex: "7C3AED",
    lightHex: "EDE9FE",
  },
  orange: {
    label: "Orange",
    solid: "bg-orange-500 text-white",
    bar: "bg-orange-500",
    checked: "bg-orange-500 text-white ring-orange-600 dark:bg-orange-600",
    ring: "ring-orange-500/50",
    text: "text-orange-600 dark:text-orange-400",
    hex: "EA580C",
    lightHex: "FFEDD5",
  },
  teal: {
    label: "Teal",
    solid: "bg-teal-500 text-white",
    bar: "bg-teal-500",
    checked: "bg-teal-500 text-white ring-teal-600 dark:bg-teal-600",
    ring: "ring-teal-500/50",
    text: "text-teal-600 dark:text-teal-400",
    hex: "0D9488",
    lightHex: "CCFBF1",
  },
  rose: {
    label: "Red",
    solid: "bg-rose-500 text-white",
    bar: "bg-rose-500",
    checked: "bg-rose-500 text-white ring-rose-600 dark:bg-rose-600",
    ring: "ring-rose-500/50",
    text: "text-rose-600 dark:text-rose-400",
    hex: "E11D48",
    lightHex: "FFE4E6",
  },
} as const;

export type MemberColor = keyof typeof MEMBER_COLORS;
export const COLOR_KEYS = Object.keys(MEMBER_COLORS) as MemberColor[];

export function isMemberColor(v: unknown): v is MemberColor {
  return typeof v === "string" && v in MEMBER_COLORS;
}

export function colorOf(c: string) {
  return MEMBER_COLORS[isMemberColor(c) ? c : "sky"];
}

/** First colour not already taken (cycles if all are used). */
export function nextFreeColor(taken: string[]): MemberColor {
  return COLOR_KEYS.find((c) => !taken.includes(c)) ?? COLOR_KEYS[taken.length % COLOR_KEYS.length];
}

export function cleanName(v: string, max = MAX_NAME_LENGTH): string {
  return v.trim().replace(/\s+/g, " ").slice(0, max);
}

export function isValidPin(pin: string): boolean {
  return /^\d{4}$/.test(pin);
}

/** Keeps the first grapheme-ish chunk of what was typed as an emoji/avatar. */
export function cleanEmoji(v: string): string {
  const s = v.trim();
  if (!s) return "🙂";
  const seg = typeof Intl !== "undefined" && "Segmenter" in Intl
    ? [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(s)][0]?.segment
    : s.slice(0, 2);
  return (seg ?? "🙂").slice(0, 16);
}
