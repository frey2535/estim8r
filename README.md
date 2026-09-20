# Estim8r

Electrical estimating for Current Flow. Take off drawings, match them to the labor taxonomy, and keep project documents together under the project name.

The 1,921 imported labor rows are **experimental / unverified**. They keep their imported man-hours and are not production-ready. Published NECA values are not populated.

## Local development

```bash
npm install
cp .env.example .env.local   # if present
npm run dev
```

The Vite app defaults to http://localhost:5177.

Auth and data use Supabase when `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set. Without them, the bundled labor library and local estimate storage still work.

Apply new database changes with the Supabase CLI against this project’s linked database:

```bash
supabase db push
```

To save documents into Buildr, set:

```
VITE_BUILDR_URL=http://localhost:5173
VITE_BUILDR_API_URL=http://localhost:3001
```

Buildr sync sends the signed-in email and, when linked, a Buildr company ID. Set the company ID in **Settings → Buildr company**. If no company ID is linked, Buildr still looks up the account by login email.

Platform owner sign-in is **Login → Platform owner sign in** (`/login/owner`) as `currentflowconsultingllc@gmail.com`. `marcus.a.frey@gmail.com` is a backup admin on the regular login page, not the platform owner.

When an estimate is created from uploaded drawings, blank header fields are filled from the title block / cover sheet (and from markup JSON when those fields are present). Missing values stay blank — Estim8r does not invent a contact, phone, or email.

## Project documents

When drawings have been uploaded and an estimate exists:

1. **Buildr project already exists** — drawings, estimate, and markup pages are saved on that project’s Estimate tab.
2. **Buildr account, no matching project** — Estim8r asks whether to create the project. If yes, Estim8r and Buildr create it and save the documents there.
3. **No Buildr account** — documents stay in Estim8r’s Estimates folder, listed by project name with the project address underneath.

Later edits to a synced estimate update the same Buildr Estimate-tab documents. The link is the Estim8r estimate id plus the stored Buildr project and invoice ids.

## Estimate presentation

Employee class and wage, productivity factors, overhead, and profit live on the **Labor & markup** tab in Estimate Builder. They are not shown on the Estimate tab or on the customer PDF.

The estimate saves as a downloadable, printable PDF from the Estimate tab and from the Estimates folder. Company branding for that PDF lives in **Settings → Estimate PDF branding**: logo, company information, colors, text color, font, header size/color, card size/color, and related controls.

## Labor architecture (Phase 1–2)

- **Taxonomy** — `labor_items` (trade / category / subcategory / item / size / unit)
- **Sources** — experimental imported units, company history, custom labor, empty published/reference slot
- **Verification** — imported rows are unverified and `production_allowed = false`
- **Custom labor** — company-isolated hours the estimator enters
- **Estimate selector** — side-by-side sources, MH × productivity factors × crew rate
- **Rates & crews** — employee-class wage book and named crews

Existing estimates keep their stored man-hours. Takeoff, drawings, auth, and Supabase integrations are unchanged.

## Checks

```bash
node src/domain/labor/auditedLibrary.test.js
node src/domain/labor/architecture.test.js
node src/domain/estimate/fromDrawings.test.js
node src/domain/estimate/fromTakeoff.test.js
node src/domain/estimate/branding.test.js
node src/domain/estimate/estimatePdf.test.js
node src/domain/estimate/projectDocuments.test.js
node src/lib/platformIdentity.test.js
node src/lib/buildrCompany.test.js
node src/domain/takeoff/aiTakeoff.test.js
node src/domain/takeoff/sizes.test.js
```
