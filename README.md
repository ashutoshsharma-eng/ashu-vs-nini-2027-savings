# Husband 🆚 Wife — 2027 Savings

A mobile-first savings challenge for **Ashutosh** and **Niharika**. Before you start, pick a shared
plan in the app — first box amount, how much each box increases by, and how many boxes (default
₹100 → ₹5,200 in steps of ₹100 × 52 = **₹1,37,800** each, **₹2,75,600** together). Either of you can
edit the plan until the first box is ticked; then it's locked for the year. Tick boxes in any order.

Built with Next.js (App Router, TypeScript, Tailwind CSS) and Neon serverless Postgres.

## Features

- 🔐 Profile picker + 4-digit PIN login (Server Actions, signed HTTP-only cookie)
- ⏱️ Auto-logout after 5 minutes idle (30-second warning; enforced server-side too)
- 🔒 See both grids live, but only tick your own boxes (enforced server-side)
- 📊 Live scoreboard: combined progress, totals, boxes completed, leader badge
- ☕ Money Date every Sunday of 2027 (52) with "who pays for the chai" and notes
- 🎯 Personal bucket lists — what the money is for (edit your own, view your partner's)
- ✈️ "Whoever quits first sponsors the other's 2028 trip" banner with last-active dates
- 🎉 Confetti on each tick; every ₹10,000 together gets a toast, a "Cheers!" card and party poppers
- 📗 Excel export: Summary (live formulas), each player's boxes, Money Dates, Bucket Lists — colour-coded
- Filters (All / Remaining / Completed), sort toggle, dark mode, Add to Home Screen

## Zero-touch database

No migrations or seed commands. On first request the app runs `CREATE TABLE IF NOT EXISTS` for
`challenge_plan`, `boxes`, `sunday_money_dates` and `bucket_items`, and seeds the 52 Sundays if empty
(boxes are created when you set up the plan). Runs in `lib/db.ts → ensureDbInitialized()`, guarded by an in-memory promise lock. If an older
version already has ticked ₹50 boxes, that progress is kept and its plan is locked in. Notes and completions
from the older first-Sunday `money_dates` table are copied over automatically.

## Run locally

```bash
cp .env.example .env.local   # fill in DATABASE_URL and PINs
npm install
npm run dev
```

## Deploy on Vercel

1. Push this repo to GitHub and import it in Vercel.
2. Add a Neon database (Vercel → Storage → Neon, or create one at neon.tech).
3. Set `DATABASE_URL`, `HUSBAND_PIN`, `WIFE_PIN` in Environment Variables.
4. Deploy, open the URL on your phone, and *Share → Add to Home Screen*.

If `DATABASE_URL` is missing, the app shows a friendly setup screen instead of crashing.
