# 2027 Savings Challenge

A mobile-first box-ticking savings challenge for **one person, a couple, or a family of up to 8**.
Everyone gets the same grid of boxes (default ₹100 → ₹5,200 in steps of ₹100 × 52 = **₹1,37,800**
each) and ticks them in any order. The plan is chosen in the app before you start and locks at the
first tick.

Built with Next.js (App Router, TypeScript, Tailwind CSS) and Neon serverless Postgres.

## How it adapts to your group

| | Solo (1) | Duo (2) | Group (3–8) |
|---|---|---|---|
| Scoreboard | Personal progress card | Side-by-side cards, 👑 leader | Shared goal bar + ranked leaderboard |
| Sundays | Weekly check-in | Money Date — fewer ticks buys chai | Money Date — fewest ticks buys chai for everyone |
| Stakes | "Don't break the chain" | Quitter sponsors the other's 2028 trip | Quitter treats everyone on the 2028 trip |

## Features

- 👥 First-run setup: group name + each person's name, emoji, colour and 4-digit PIN (protected by `SETUP_CODE`)
- 👑 One admin: add/remove people, edit them, reset PINs, rename the group, hand over the admin role
- 🔐 PINs hashed (scrypt) in the database; everyone can change their own PIN; signed HTTP-only session cookie
- ⏱️ Auto-logout after 5 minutes idle (30-second warning; enforced server-side too)
- 🔒 Everyone sees everyone's grid live, but can only tick their own boxes (enforced server-side)
- 📋 Shared plan: first box, step (same / suggested / custom), number of boxes, live preview
- ☕ Every Sunday of 2027 tracked with notes; 🎯 personal bucket lists
- 🎉 Confetti on each tick; every ₹10,000 crossed gets a toast, a "Cheers!" card and party poppers
- 📗 Excel export: Summary (live formulas, one column per person), each person's boxes, Sundays, bucket lists
- Filters, sort toggle, dark mode, Add to Home Screen

## Zero-touch database

No migrations or seed commands. On first request the app creates any missing tables
(`group_settings`, `members`, `challenge_plan`, `boxes`, `sunday_money_dates`, `bucket_items`) and
seeds the 52 Sundays (`lib/db.ts → ensureDbInitialized()`, guarded by an in-memory promise lock).

Upgrading from the original husband-vs-wife version is automatic: Ashutosh (admin) and Niharika
become members with their existing PINs (`HUSBAND_PIN` / `WIFE_PIN`, or 1111/2222), and all their
boxes, ticks and bucket items carry over.

## Run locally

```bash
cp .env.example .env.local   # fill in DATABASE_URL and SETUP_CODE
npm install
npm run dev
```

## Deploy on Vercel

1. Push this repo to GitHub and import it in Vercel.
2. Add a Neon database (Vercel → Storage → Neon, or create one at neon.tech).
3. Set `DATABASE_URL` and `SETUP_CODE` in Environment Variables.
4. Deploy, open the URL, enter the setup code, add your people, and pick the plan.
5. On each phone: *Share → Add to Home Screen*.

If `DATABASE_URL` is missing, the app shows a friendly setup screen instead of crashing.
