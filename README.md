# Tenant Ledger

A small rental accounting app for tracking units, tenants, rent payments, yearly expenses,
and profit/loss — synced across devices with Firebase. You mark each month's payment as
paid once you've received it (e.g. by Interac e-Transfer); there's no email scanning.

## Why this fixes your spreadsheet problem

Your old sheet stored one **column per tenant**. When a tenant moved out, you had to edit
or repurpose that column, which corrupted history and threw off yearly totals.

This app stores three separate things instead:

- **Units** — the physical rooms/spaces you rent out. These never change (e.g. "Main Floor
  – Room A", "Basement – Room B").
- **Tenancies** — a record of one tenant living in one unit for a period of time (rent
  amount, start date, end date). A unit can have many tenancies over the years, but only
  one *active* tenancy at a time.
- **Payments** — one record per tenancy per month. Tied to the tenancy, not the unit and
  not a spreadsheet column.

When a tenant leaves: you end their tenancy and start a new one on the same unit. Their
payment history stays exactly as it was. Yearly revenue is just "sum of all payments with
a date in that year" — it never needs to be recalculated or fixed by hand.

## What's included

- `index.html` / `css/style.css` / `js/*.js` — the app itself (static, no build step)
- `firestore.rules` — security rules to paste into your Firebase project
- This README — full setup

## 1. Create your Firebase project

1. Go to https://console.firebase.google.com → **Add project** → name it (e.g.
   `tenant-ledger`) → finish the wizard (you can skip Google Analytics).
2. In the project, click the **</>** (web app) icon to register a new web app. Name it
   anything. You do **not** need Firebase Hosting — you'll host on GitHub Pages instead.
3. Copy the `firebaseConfig` object it shows you.
4. Open `js/firebase-config.js` in this project and paste your values in.
5. In the left sidebar go to **Build → Firestore Database → Create database**. Start in
   **production mode**, pick a region close to you.
6. Go to the **Rules** tab of Firestore and paste in the contents of `firestore.rules`
   from this project, then **Publish**.
7. Go to **Build → Authentication → Get started**, enable the **Google** sign-in provider.
   This app uses Google sign-in so your data is private to you and syncs across your
   devices.

## 2. Deploy to GitHub Pages

1. Push this whole folder to a GitHub repo.
2. In the repo, go to **Settings → Pages** → Source: **Deploy from a branch** → pick
   `main` and `/ (root)` → Save.
3. Your app will be live at `https://<your-username>.github.io/<repo-name>/` in a minute
   or two.
4. Back in Firebase console → **Authentication → Settings → Authorized domains**, add
   `<your-username>.github.io`.

## 3. Marking payments as received

Each month, once a tenant's rent shows up (by Interac e-Transfer or otherwise), open the
**Payments** tab, click that tenant's cell for the month, and record the amount, date, and
method. The **Dashboard** tab also has a one-tap "Mark as paid" button for the current
month per unit if the full rent came in on time.

## 4. Importing your existing spreadsheet data

Your current sheet has 9 tenant slots across 2 units (Main Floor, Basement) and expense
totals for 2024–2026. Rather than a risky automated import (your sheet's date labels are
inconsistent — e.g. row 3 says "January 2026" but sits above rows dated Feb–Dec 2025 —
so an automated script would likely import wrong months), it's safer to re-enter your
current tenants once by hand in the **Units & Tenants** tab (2–3 minutes), and your
expense totals in the **Expenses** tab per year. Everything from that point forward is
tracked cleanly with no re-entry needed.

## Data model (Firestore)

```
units/{id}      { name, floor, order }
tenancies/{id}  { unitId, tenantName, rentAmount, startDate, endDate|null, status }
payments/{id}   { tenancyId, unitId, month "YYYY-MM", amountDue, amountPaid,
                  status, datePaid|null, method, notes }
expenses/{id}   { year, category, amount, notes }
```
