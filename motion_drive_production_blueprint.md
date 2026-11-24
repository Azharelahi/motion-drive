# Motion Drive Pty Ltd (Tarneit, VIC) — Production Application Blueprint

> **Purpose:** Clear, bite-sized execution guide for building **Motion Drive Rental Manager** in **Next.js (App Router) + TypeScript** with **PostgreSQL + Prisma**. Every stage is broken into small, focused micro-steps with immediate checks so errors are caught right away—without over-engineering or losing a single requirement from `MotionDrive_Rental_Manager_OLD_LAYOUT_CURRENT_DATA_FIXED (2).html`.

## 0. Simple Ground Rules

1. **Keep Everything From the Original App:** Do not drop any field, status, document type, alert rule, contract clause, swap rule, or seed record.

2. **Keep the Architecture Simple & Clean:** Use standard Next.js App Router pages, simple server/API helpers, PostgreSQL transactions (`prisma.$transaction`), and a plain file folder (`./storage/uploads`) for files up to **25 MB**. Avoid heavy enterprise abstractions or over-nested layers.

3. **Do Not Build Unrequested Features:** No rent payment ledger/tracking, no login/auth wall, and no automated reminders to drivers (alerts stay on-screen only).

4. **Standard Formatting:**

   * Money: **Australian Dollars (`AUD`)** (`Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' })`).

   * Dates: **Australian format (`DD/MM/YYYY`)** in UI and printed agreements; ISO `YYYY-MM-DD` in storage.

   * Vehicle registration: Always saved in **UPPERCASE**.

5. **Small Steps, Immediate Checks:** Finish one small numbered step at a time, run its quick check, and only move to the next step once it passes.

## 1. Simple, Clean Folder Structure

```
motion-drive/
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
├── public/
│   ├── logo.svg
│   └── pdf.worker.min.mjs
├── storage/
│   └── uploads/
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── globals.css
│   │   ├── error.tsx
│   │   ├── page.tsx                 # Dashboard
│   │   ├── vehicles/
│   │   │   ├── page.tsx             # Vehicle Register
│   │   │   └── [id]/page.tsx      # Vehicle Profile
│   │   ├── drivers/
│   │   │   ├── page.tsx             # Driver Register
│   │   │   └── [id]/page.tsx      # Driver Profile
│   │   ├── rentals/
│   │   │   └── new/page.tsx         # New Rental
│   │   ├── swaps/
│   │   │   ├── page.tsx             # Swap Cars + Saved Swaps
│   │   │   └── [id]/page.tsx      # Swap Agreement View
│   │   ├── contracts/
│   │   │   ├── page.tsx             # Saved Contracts
│   │   │   └── [id]/page.tsx      # Contract View
│   │   └── api/
│   │       ├── health/route.ts
│   │       ├── vehicles/route.ts
│   │       ├── vehicles/[id]/route.ts
│   │       ├── drivers/route.ts
│   │       ├── drivers/[id]/route.ts
│   │       ├── contracts/route.ts
│   │       ├── contracts/[id]/route.ts
│   │       ├── contracts/[id]/end/route.ts
│   │       ├── contracts/[id]/reopen/route.ts
│   │       ├── swaps/route.ts
│   │       ├── swaps/[id]/route.ts
│   │       ├── documents/route.ts
│   │       ├── documents/[id]/route.ts
│   │       ├── documents/[id]/file/route.ts
│   │       └── backup/
│   │           ├── export/route.ts
│   │           └── import/route.ts
│   ├── components/
│   │   ├── AppShell.tsx             # Top bar + sidebar + responsive & print wrapper
│   │   ├── GlobalErrorBanner.tsx    # Reusable error/alert box + confirm modal
│   │   ├── DocumentPanel.tsx        # Multi-file upload, doc list, Read & Update modal
│   │   ├── RentalContractView.tsx   # Contract layout + Annexure A (13 clauses)
│   │   └── SwapAgreementView.tsx    # Swap layout + 5 terms + 3 signature lines
│   └── lib/
│       ├── db.ts                    # Prisma client
│       ├── format.ts                # AUD money, DD/MM/YYYY date, daysLeft helpers
│       ├── storage.ts               # Save/read/delete files up to 25 MB
│       ├── validation.ts            # Zod schemas
│       ├── pdf-reader.ts            # PDF.js text extractor & field finder
│       ├── clauses.ts               # Company info, 13 Annexure A clauses, 5 swap terms
│       └── seed-data.ts             # 10 vehicles, drivers, contracts, 6 PDFs, drops "Mozi"
└── tests/
    ├── unit/
    ├── integration/
    └── e2e/
```

## 2. Small-Batch Stages & Verification Checkpoints

### Stage 1: Project Setup & Database Schema

* **Step 1.1 — Scaffold Next.js & Dependencies:** Create the Next.js + TypeScript app and install `prisma`, `@prisma/client`, `zod`, `pdfjs-dist`, `lucide-react`, `vitest`, `tsx`, and `@playwright/test`. Copy `pdf.worker.min.mjs` into `public/`.

  * *Check:* Run `npx tsc --noEmit`.

* **Step 1.2 — Write Prisma Schema & Active-Rental Rules:** Define `Vehicle`, `Driver`, `Contract`, `VehicleSwap`, and `Document` in `prisma/schema.prisma`. Add partial unique indexes in SQL so at most **one `Active` contract** can exist per `vehicleId` and per `driverId`.

  * *Check:* Run `npx prisma validate` and `npx prisma migrate dev --name init`.

* **Step 1.3 — Create DB Client & Health Endpoint:** Add `src/lib/db.ts` and `GET /api/health` checking database connection and storage folder readiness.

  * *Check:* Start dev server and call `GET /api/health` -> expect `200 OK`.

### Stage 2: Shared Helpers, Error UI & Storage

* **Step 2.1 — Date, Money & Validation Helpers:** Create `src/lib/format.ts` (`formatAUD`, `formatDateAU` as `DD/MM/YYYY`, `daysUntil` with invalid/missing date detection) and `src/lib/validation.ts`.

  * *Check:* Run unit test on `format.ts` (`npx vitest run tests/unit/format.test.ts`).

* **Step 2.2 — File Storage Helper (Up to 25 MB):** Create `src/lib/storage.ts` to write, read, list, and delete files safely in `./storage/uploads`, rejecting files over **25 MB** or disallowed types (`PDF, HTML, TXT, JSON, DOC, DOCX, images`).

  * *Check:* Run unit/integration test saving and deleting a sample file cleanly.

* **Step 2.3 — Reusable Error Boundary & Confirm Modal:** Create `src/components/GlobalErrorBanner.tsx` and `src/app/error.tsx` for consistent error display, alerts, and user confirmation dialogs across all pages.

  * *Check:* Run `npm run build`.

### Stage 3: Seed Data, Sync Rules & Backup / Restore

* **Step 3.1 — Seed Data & `"Mozi"` Cleanup:** Put the exact **10 preloaded vehicles**, **drivers**, **contracts**, and **6 signed agreement PDFs** into `src/lib/seed-data.ts`. Ensure any driver named `"Mozi"` is dropped.

  * *Check:* Run `npx prisma db seed` and verify counts and zero `"Mozi"` drivers.

* **Step 3.2 — Non-Destructive Merge & Active Rental Sync:** Run sync on startup/load that merges seed items without overwriting user edits, removes duplicates, auto-ends older duplicate active rentals per car/driver, and syncs car (`Rented` / `Available`) and driver (`Current` / `Ended`) statuses.

  * *Check:* Edit a seeded vehicle's rent, re-seed/sync, and confirm the edit is kept while duplicate active rentals are ended.

* **Step 3.3 — Export Backup (`MotionDrive_Backup_date.json`):** Build `GET /api/backup/export` returning all records plus all uploaded/seeded document files in one JSON file named `MotionDrive_Backup_YYYY-MM-DD.json`.

  * *Check:* Download backup file and verify it contains records and embedded file data.

* **Step 3.4 — Import Backup (Confirm + Validate + Restore to Dashboard):** Build `POST /api/backup/import` with confirmation prompt in the UI, strict validation that rejects invalid files without changing data, atomic DB + file restore, and redirect to **Dashboard**.

  * *Check:* Test importing a bad file (rejected safely) and importing a valid backup (data & files restored, opens Dashboard).

### Stage 4: Shell, Navigation & A4 Print Styles

* **Step 4.1 — Top Bar & 6-Page Sidebar:** Build `src/components/AppShell.tsx` with Motion Drive Pty Ltd branding, backup/import buttons, and the 6 sidebar links: **Dashboard**, **Vehicle Register**, **Driver Register**, **New Rental**, **Swap Cars**, **Saved Contracts**.

  * *Check:* Navigate to all 6 routes in browser and verify zero console errors.

* **Step 4.2 — Responsive Mobile Stacking & A4 Print CSS:** Stack grids on mobile screens and add `@media print` (`A4`, `10mm` margins) hiding everything except the active contract or swap agreement.

  * *Check:* Run Playwright test checking mobile grid stacking and print layout hiding non-agreement elements.

### Stage 5: Vehicle Register & Vehicle Profile

* **Step 5.1 — Vehicle API & Contract-Delete Guard:** Build `GET/POST /api/vehicles` and `GET/PATCH/DELETE /api/vehicles/[id]` saving registration in **UPPERCASE**, defaulting bond to `500`, KM allowance to `"Unlimited"`, and pickup to `"Tarneit, VIC"`, and blocking delete if linked to any contract.

  * *Check:* Test create, edit, and delete-blocked-when-linked via integration test.

* **Step 5.2 — Vehicle Register Page:** Build `/vehicles` with all vehicle fields, `Cancel Edit` button, search by `registration, model, year, or colour`, table showing `current driver, taken since date, rent, status, and document count`, and `Profile / Edit / Delete` buttons.

  * *Check:* Test add, edit, cancel edit, search, and delete in browser.

* **Step 5.3 — Vehicle Profile Page & Quick Update:** Build `/vehicles/[id]` showing all vehicle info, expiries, current driver, mobile, taken date, rent, bond, excess, buttons (`Edit Vehicle`, `Open Driver`, `Open Contract`), **Quick Update** (status, 3 expiry dates, odometer, next service km), and Document Panel.

  * *Check:* Update status, expiries, odometer, and next service km on Vehicle Profile and verify persistence.

### Stage 6: Driver Register & Driver Profile

* **Step 6.1 — Driver API & Contract-Delete Guard:** Build `GET/POST /api/drivers` and `GET/PATCH/DELETE /api/drivers/[id]` with all driver fields and blocking delete if linked to any contract.

  * *Check:* Test create, edit, and delete-blocked-when-linked via integration test.

* **Step 6.2 — Driver Register Page:** Build `/drivers` with all driver fields, search by `name, mobile, email, or licence number`, table showing `current car, car taken date, licence expiry, status, and document count`, and `Profile / Edit / Delete` buttons.

  * *Check:* Test add, edit, search, and delete in browser.

* **Step 6.3 — Driver Profile Page & Licence Warning:** Build `/drivers/[id]` showing personal & licence info, current vehicle, taken date, rent, bond, excess, initial end date, ongoing term, notice period, **warning card** if licence expiry is missing/expired/invalid or within `90` days, buttons (`Edit Driver`, `Open Car`, `Open Contract`), and Document Panel.

  * *Check:* Verify warning card appears for missing, expired, invalid, and `<= 90`-day licence expiries.

### Stage 7: Documents & PDF.js "Read & Update"

* **Step 7.1 — Multi-File Upload & Document Actions API:** Build `POST /api/documents` (multiple files up to **25 MB** each, optional expiry date, exact **Driver** and **Vehicle** document types), `GET /api/documents/[id]/file` (`View` in new tab + `Download`), `PATCH /api/documents/[id]` (`Edit Expiry`), and `DELETE /api/documents/[id]`.

  * *Check:* Test batch upload, `> 25 MB` rejection, view, edit expiry, download, and delete.

* **Step 7.2 — PDF.js Text Extractor & "Read & Update" Flow:** Build `src/lib/pdf-reader.ts` and `DocumentPanel.tsx` `Read & Update` modal to read text via PDF.js, extract **registration, VIN, licence number, and expiry date**, show proposed updates for **user confirmation before applying**, and handle **scanned image PDFs** by prompting manual expiry entry.

  * *Check:* Test on a text PDF (confirms and updates profile) and a scanned image PDF (prompts manual expiry entry).

### Stage 8: New Rental, Contract View & Saved Contracts

* **Step 8.1 — New Rental Atomic Creation (`MD-YYYY-NNNN`):** Build `POST /api/contracts` and `/rentals/new` (Step 1 vehicle + auto `MD-2026-0007` style number; Step 2 driver; grey out active cars/drivers with current holder note; Step 3 agreement/start/end dates, auto-filled rent/bond/excess, ongoing term default `Month to month`, notice `7 days`, payment frequency `Weekly in advance`, `Bank Transfer` or `PayID`, rideshare & private use `Yes/No`; set car `Rented` & driver `Current`; block duplicate active rental; open Contract View).

  * *Check:* Create a rental, verify statuses and greyed-out active items, and verify duplicate active rental is blocked.

* **Step 8.2 — Contract Document View & Annexure A (13 Clauses):** Build `/contracts/[id]` (`RentalContractView.tsx`) with logo, company details (`ABN`, address, email, phone), driver/vehicle tables, terms summary, key terms, driver signature block, **all 13 Annexure A clauses** (including Victoria governing law), and Print / Save as PDF button.

  * *Check:* Open a contract and verify all 13 clauses, tables, and print layout.

* **Step 8.3 — Saved Contracts Page (`End` & `Reopen`):** Build `/contracts` with search (`contract number, driver, mobile, registration, or model`), table (`contract, driver, mobile, vehicle, start, rent, status`), `Open`, `Mark Ended` (car -> `Available`, driver -> `Ended`), and `Reopen` (blocked if car or driver is in another active rental).

  * *Check:* Test search, ending a contract, reopening when free, and reopening blocked when occupied.

### Stage 9: Swap Cars & Vehicle Swap Agreement

* **Step 9.1 — Atomic Swap API (`MD-SWAP-YYYY-NNN-A/B`):** Build `POST /api/swaps` inside a single DB transaction: validate two different drivers with active cars and different cars; end both old contracts on `swapDate`; create two new active contracts (`MD-SWAP-<year>-001-A` and `-B`); save one swap record; keep cars `Rented` and drivers `Current`.

  * *Check:* Test swap validation rules and atomic transaction rollback on failure via integration test.

* **Step 9.2 — Swap Cars UI, Saved Swaps & Swap Agreement View:** Build `/swaps` (only drivers with active car, preview cards, `swapDate` default today, notes, editable new weekly rents auto-filled from the other car, Saved Vehicle Swaps table with `Open Agreement`) and `/swaps/[id]` (`SwapAgreementView.tsx` with exchange table, **5 agreed terms**, notes, **3 signature lines**, and Print button).

  * *Check:* Execute a swap end-to-end, confirm both new contracts, verify Saved Swaps list, and verify Swap Agreement layout.

### Stage 10: Dashboard, Alert Rules & Full End-to-End Sign-Off

* **Step 10.1 — Dashboard Counters, 5 Alert Rules & Expiry Registers:** Build `/` and `/api/dashboard` with the **4 counters** (`Vehicles`, `Drivers`, `Saved Contracts`, `Active Rentals`), **Attention Needed** (current driver licence missing/expired/invalid or `<= 90` days; rideshare accreditation expired or `<= 90` days; vehicle rego/insurance/inspection expired or `<= 45` days; service due within `1,000` km of odometer; any uploaded document expiring within `60` days; `"No urgent alerts"` when clear), **Vehicle Expiry Register** (badges, days left, rego button -> Vehicle Profile), **Driver Document Expiry Register** (current drivers), **Quick Action buttons** (`Create New Contract`, `Swap Cars`, `Add or View Vehicles`, `Add or View Drivers`), and **Recent Contracts** (latest 8 with `Open`).

  * *Check:* Verify each of the 5 alert rules, `"No urgent alerts"` state, expiry registers, quick actions, and latest 8 contracts.

* **Step 10.2 — Final Full Regression Run:** Run all unit, integration, and Playwright E2E tests together after a clean seed and backup/restore cycle.

  * *Check:* Run `npm run build && npx vitest run && npx playwright test` with 0 failures.