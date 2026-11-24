export default function DefaultPinBanner() {
  return (
    <div className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900">
      ⚠️ Default PINs (1111 / 2222) are active. Set <code>HUSBAND_PIN</code> and{" "}
      <code>WIFE_PIN</code> in your environment to lock things down.
    </div>
  );
}
