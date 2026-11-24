# Husband 🆚 Wife — 2027 Savings

A mobile-first savings challenge for **Ashutosh** and **Niharika**. Each player has 52 boxes
(₹50 → ₹2,600 in steps of ₹50 = **₹68,900** each, **₹1,37,800** together). Tick boxes in any order.

Built with Next.js (App Router, TypeScript, Tailwind CSS) and Neon serverless Postgres.

## Features

- 🔐 Profile picker + 4-digit PIN login (Server Actions, signed HTTP-only cookie)
- 🔒 See both grids live, but only tick your own boxes (enforced server-side)
- 📊 Live scoreboard: combined progress, totals, boxes completed, leader badge
- ☕ Money Date tracker for the 12 First Sundays of 2027 with "who pays for the chai" and notes
- ✈️ "Whoever quits first sponsors the other's 2028 trip" banner with last-active dates
- 🎉 Confetti on each tick and every ₹10,000 combined milestone
- Filters (All / Remaining / Completed), sort toggle, CSV export, dark mode, Add to Home Screen

## Zero-touch database

No migrations or seed commands. On first request the app runs `CREATE TABLE IF NOT EXISTS` for
`boxes` and `money_dates` and seeds 104 boxes and 12 Money Dates if the tables are empty
(`lib/db.ts → ensureDbInitialized()`, guarded by an in-memory promise lock).

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
