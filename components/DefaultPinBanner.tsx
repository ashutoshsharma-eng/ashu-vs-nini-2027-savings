export default function DefaultPinBanner({ onFix }: { onFix?: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900">
      <span>⚠️ You&apos;re still using a default PIN. Pick your own so nobody else can tick your boxes.</span>
      {onFix && (
        <button
          type="button"
          onClick={onFix}
          className="shrink-0 rounded-full bg-amber-500 px-3 py-1 font-semibold text-white active:scale-95"
        >
          Change
        </button>
      )}
    </div>
  );
}
