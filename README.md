# TripSplit — group trip expenses

A small Next.js app for tracking every expense on a group trip. Everyone opens the same trip link on their own phone, logs what they pay, attaches the bill photo, and the app works out who owes whom.

## Features

- **Shared trip link.** Create a trip, share the link on WhatsApp, and each person picks their name. Everyone sees the same data, which refreshes every 15 seconds.
- **Detailed expenses.** Each one records the amount, description, category, who paid, date, place, payment method (UPI, cash or card), notes and **receipt photos**. The app records who added or edited each one.
- **Flexible splits.** Split equally, by exact ₹ amounts, by percentage, or by shares (a couple counts as 2). You can include only some people, for example if one person skipped the club.
- **Balances and settle-up.**
  - Everyone's net balance.
  - The fewest payments that clear all debts.
  - One-tap **Pay via UPI** (opens GPay, PhonePe or Paytm with the amount filled in).
  - **Mark paid** to record a settle-up.
- **Per-person ledger.** Tap anyone to see every expense they paid for or shared in, and how each one moved their balance.
- **Budget and charts.**
  - A group budget, with optional per-category budgets.
  - A budget meter, with warnings at 80% and when you go over.
  - Daily pace ("at this pace the trip will cost …").
  - Charts of spending by category, spending by day, and who paid vs. who spent.
  - Payment-method breakdown and the biggest expenses.
  - Every chart has a table view.
- **Kitty support.** If everyone puts money into a common pool, record each contribution as a payment to whoever holds the kitty, and log expenses as paid by them.
- Works on phones (bottom tab bar, camera upload) and in light or dark mode.

All money is stored as whole paise, so splits always add up exactly to the rupee.

## Run it locally

```bash
npm install
npm run dev
```

Open http://localhost:3000. With no database configured, local dev stores everything in `.data/db.json`.

```bash
npm test   # split, settle-up and budget maths
```

## Deploy to Vercel

The app needs a Redis database so everyone's phones share the same data. The free Upstash Redis tier is plenty for a trip.

1. Import this repo into Vercel (or run `vercel`).
2. In the Vercel project, open **Storage → Create Database → Upstash (Redis)**, create the free database and connect it to the project. This adds `KV_REST_API_URL` and `KV_REST_API_TOKEN` automatically.
   - Alternatively, create a database at https://console.upstash.com and add `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` as environment variables yourself.
3. Redeploy, open the site, create your trip, and share the link.

If the variables are missing on Vercel, the app shows "Storage isn't set up yet" instead of losing data.

## Good to know

- **The link is the key.** There are no accounts; anyone with a trip's link can view and edit it, so share it only with the group.
- **Receipt photos** are shrunk in the browser to a few hundred KB before upload.
- Someone can be removed from a trip only when no expense or payment involves them. Renaming is always allowed.

## Project layout

```
app/
  page.js                 home: create a trip, open a shared link, recent trips
  t/[tripId]/page.js      the trip itself
  api/trips/...           JSON API (trips, members, expenses, payments, receipts)
components/               TripApp + one file per tab, the expense form, charts, receipts
lib/
  split.js                split maths, balances, settle-up, per-person ledger
  insights.js             budget pace and chart aggregations
  money.js                paise ↔ rupees, ₹ formatting
  store.js, db.js         Redis layout and client (Upstash REST, file fallback in dev)
  validate.js             server-side input checks
test/                     node --test unit tests
```
