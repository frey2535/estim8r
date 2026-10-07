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

## Live supplier catalog pricing

Estimate Builder → **Supplier Prices** searches official distributor catalogs and writes those current prices onto estimate lines. Estim8r does not invent a price if a catalog is unconfigured or returns no match.

| Source | Official API | Secrets |
|---|---|---|
| Mouser | Search API | `MOUSER_API_KEY` |
| Digi-Key | Product Information v4 | `DIGIKEY_CLIENT_ID`, `DIGIKEY_CLIENT_SECRET` (`DIGIKEY_SANDBOX=true` for sandbox) |
| Nexar Supply (Octopart) | GraphQL authorized-distributor offers | `NEXAR_CLIENT_ID`, `NEXAR_CLIENT_SECRET` |
| Newark / element14 | Product Search | `ELEMENT14_API_KEY` (`ELEMENT14_STORE_ID=us` for Newark) |

Do **not** prefix these with `VITE_`. Keys stay on the server.

Local (`npm run dev`): the Vite proxy at `POST /api/live-supplier-catalog` reads the secrets from `.env` / `.env.local`. GitHub Pages (and its Fastly/nginx edge) only serves GET/HEAD, so that same POST on `https://estim8r.currentflowconsulting.org/api/live-supplier-catalog` returns `405 Not Allowed`. Production never uses that path.

Production: the Supplier Prices tab calls the `search-supplier-catalog` Edge Function. Store the same secret names and deploy the function (do not `supabase db push` the Estim8r migration history onto the shared project):

```bash
supabase secrets set MOUSER_API_KEY=...
supabase secrets set DIGIKEY_CLIENT_ID=...
supabase secrets set DIGIKEY_CLIENT_SECRET=...
supabase secrets set NEXAR_CLIENT_ID=...
supabase secrets set NEXAR_CLIENT_SECRET=...
supabase secrets set ELEMENT14_API_KEY=...
supabase functions deploy search-supplier-catalog
```

Sign up at [Mouser](https://www.mouser.com/api-shopping/), [Digi-Key](https://developer.digikey.com/), [Nexar](https://nexar.com/api), and [element14](https://partner.element14.com/). CSV import remains for supply-house quotes that have no public catalog API.

Apply new database changes with the Supabase CLI against this project’s linked database:

```bash
supabase db push
```

To save documents into Buildr, set:

```
VITE_BUILDR_URL=http://localhost:5173
VITE_BUILDR_API_URL=http://localhost:3001
```

GitHub Pages builds pass `VITE_BUILDR_URL` and `VITE_BUILDR_API_URL` from repository secrets. A production build without those values — or with localhost secrets left over from local README examples — falls back to `https://buildrpm.com` so `/from-buildr` SSO verify and Save can still POST `/functions/verifyFamilyAppSSOToken`, `/estim8r/account-status`, and `/estim8r/save-project-docs`. Local `npm run dev` still uses localhost.

`/from-buildr` is the company landing from the Buildr sidebar. It reuses the existing Buildr SSO verify endpoint plus email / company ID. Employees with an Access Control grant enter the company Estim8r; they do not download or install their own copy. This does not require `supabase db push` of full migration history.

Buildr sync sends the signed-in email and, when linked, a Buildr company ID. Set the company ID in **Settings → Buildr company**. If no company ID is linked, Buildr still looks up the account by login email. If a company is linked or an estimate was already synced, a failed Buildr save shows an error instead of a silent local-only save.

Sign in from the header **Sign in** button (opens the sign-in page) or **Sign in with Google**. The sign-in page also has **Sign in with Google**, email/password, and a **Platform owner sign in** button. Platform owner is `currentflowconsultingllc@gmail.com`. `marcus.a.frey@gmail.com` is a backup admin on the regular sign-in page, not the platform owner.

After the platform owner (or backup admin) signs in, **Access** in the header opens **Estim8r access** (`/admin`). Grant or invite by email, and revoke from the user list. Owner and backup admin rows stay protected. Apply `supabase db push` so the grant/revoke RPCs exist.

The same owner and backup admin see a **Cursor** button on every app screen (takeoff, estimate, markup, access, and the rest). It opens a floating panel on top of the current view so they can keep using the page. Day One / company admins never see it. There is no API key field and no Cloud Agents billing. The panel inspects this tab (route, visible UI, estimate/takeoff/markup state, console errors, failed requests, validation) and queues corrections on the Cursor Project session when `npm run dev` can see that session. It does not invent issues. Without Supabase, `?localEmail=currentflowconsultingllc@gmail.com` (or the backup admin email) is the local owner hook.

Google/Gmail sign-in sends the user to Supabase, then back to this origin with a trailing slash (`https://estim8r.currentflowconsulting.org/` or `http://localhost:5177/`). GitHub Pages 301s `/login` to `/login/`, so the app does not use `/login` as `redirectTo`. If Google or Supabase still rejects the hop, Estim8r shows the error on the sign-in page (and as a toast from the header Google button). Set:

1. **Supabase → Authentication → Providers → Google** — enable it. Paste the real Google Cloud client ID and secret. Do not use a placeholder client.
2. **Google Cloud → Credentials → OAuth client (Web)** — Authorized JavaScript origins: `https://estim8r.currentflowconsulting.org` and `http://localhost:5177`. Authorized redirect URI must be the Supabase callback only, `https://gqdxvctvufalunaaopyj.supabase.co/auth/v1/callback` (copy it from the Google provider page). Do not put the Estim8r site URL there. A missing callback is `redirect_uri_mismatch` and Google never returns to Estim8r.
3. **Supabase → Authentication → URL Configuration** — Site URL `https://estim8r.currentflowconsulting.org`. Redirect URLs must include both slash variants: `https://estim8r.currentflowconsulting.org`, `https://estim8r.currentflowconsulting.org/`, `https://estim8r.currentflowconsulting.org/**`, plus `http://localhost:5177`, `http://localhost:5177/`, and `http://localhost:5177/**`. If this Supabase project is also used by another Current Flow app, add Estim8r’s URLs; the Site URL alone is not enough.
4. If that Gmail already has an email/password user, enable identity linking for the same email (or use the same Google account after linking). Otherwise Google returns 400 for the second identity.

Do not run `supabase db push` of the full Estim8r migration history against the shared Current Flow project.

When an estimate is created from uploaded drawings, blank header fields are filled from the title block / cover sheet (and from markup JSON when those fields are present). Missing values stay blank — Estim8r does not invent a contact, phone, or email.

## Project documents

Save from Estimate Builder once the project has a name. Drawings, takeoff, and markup pages are optional. Saving without a project name asks for a name; missing drawings do not block save.

- **Standalone estimate** — items, quantities, labor, and markup save to the Estimates folder under the project name. If a Buildr company is linked, the estimate also syncs to that project’s Estimate tab.
- **Drawings + takeoff** — when drawings have been uploaded and an estimate exists:
  1. **Buildr project already exists** — drawings, estimate, and markup pages are saved on that project’s Estimate tab.
  2. **Buildr account, no matching project** — Estim8r asks whether to create the project. If yes, Estim8r and Buildr create it and save the documents there.
  3. **No Buildr account** — documents stay in Estim8r’s Estimates folder, listed by project name with the project address underneath.

Later edits to a synced estimate update the same Buildr Estimate-tab documents. The link is the Estim8r estimate id plus the stored Buildr project and invoice ids.

**New Estimate** (`/estimates/new`) always opens a blank template (empty header and a ready-to-fill line). It does not reopen the last job. Opening a saved project or leaving Takeoff passes `file` and `size` so that estimate still loads.

## Estimate presentation

Employee class and wage, productivity factors, overhead %, and profit % live on the **Labor & markup** tab in Estimate Builder. The Estimate tab can turn on an **itemized estimate** (pick which lines are included, with check-all) and choose which customer totals appear: Material Total, Labor Total, Overhead, Profit, and Total. The branded PDF follows those choices. Wages, crew, and productivity factors stay off the customer PDF.

The estimate saves as a downloadable, printable PDF from the Estimate tab and from the Estimates folder. Company branding for that PDF lives in **Settings → Estimate PDF branding**: logo, company information, colors, text color, font, header size/color, card size/color, and related controls.

## Takeoff and markup

Takeoff (`/takeoff`) and markup (`/markup`) are the bid-critical drawing tools.

- Legend types are read first and used to classify plan symbols. Markers sit on extracted fixture geometry when the PDF has it.
- Quantities persisted to the estimate are **plan detections**, not the legend/schedule qty column. A plan-vs-schedule table shows mismatches for review.
- Markup pages split **notes**, **devices by type**, **conduit runs**, and **circuits per conduit**. Conduit stays off device-count sheets.
- Non-electrical sheets are skipped. VF/EF count as electrical equipment. Device dropdowns stay on the selected trade and only list types found on the plan. Markers do not print type codes. Model numbers are only listed when the drawing or catalog already has them.
- Accuracy is measured on the Soccer Pavilion and Pottsville fixtures (`node src/domain/takeoff/soccerPavilionAccuracy.test.js`, `node src/domain/takeoff/expandedCorpusAccuracy.test.js`). The UI shows pending/accepted/rejected review counts and does not claim 99% without those numbers. Classes without a real fixture are skipped and documented, not invented.
- Empty, loading, and error states are shown on desktop and phone. Local development without Supabase uses a localhost estimator so `/takeoff` and `/markup` can be exercised.

The Estimates folder **Markup pages** button opens `/markup`. Edits write back to the takeoff.

## Labor architecture (Phase 1–2)

- **Taxonomy** — `labor_items` (trade / category / subcategory / item / size / unit)
- **Sources** — experimental imported units, company history, custom labor, empty published/reference slot
- **Market comparison** — hours and labor dollars vs a verified published reference only (`labor_units` with named source, edition/year, and `verification_status = verified`). The 1,921 imported rows never become a market average. If no verified reference exists, the estimate says so. NECA is not populated unless licensed.
- **Verification** — imported rows are unverified and `production_allowed = false`
- **Custom labor** — company-isolated hours the estimator enters
- **Estimate selector** — side-by-side sources, MH × productivity factors × crew rate
- **Rates & crews** — employee-class wage book (shop default $95/hr for every class; last saved rates persist) and named crews

Existing estimates keep their stored man-hours. Takeoff, drawings, auth, and Supabase integrations are unchanged.

## Checks

```bash
node src/domain/labor/auditedLibrary.test.js
node src/domain/labor/architecture.test.js
node src/domain/labor/rates.test.js
node src/domain/estimate/fromDrawings.test.js
node src/domain/estimate/fromTakeoff.test.js
node src/domain/estimate/manualLineLabor.test.js
node src/domain/estimate/lineLaborCatalog.test.js
node src/domain/estimate/estimateStore.test.js
node src/domain/estimate/branding.test.js
node src/domain/estimate/estimatePdf.test.js
node src/api/buildrBridge.test.js
node src/domain/estimate/projectDocuments.test.js
node src/lib/platformIdentity.test.js
node src/lib/ownerCursorChat.test.js
node src/lib/ownerChatInspector.test.js
node src/lib/buildrCompany.test.js
node src/lib/authRedirect.test.js
node src/lib/ownerAccessRules.test.js
node src/domain/takeoff/aiTakeoff.test.js
node src/domain/takeoff/deviceStyles.test.js
node src/domain/takeoff/ortho.test.js
node src/domain/takeoff/junctionHardware.test.js
node src/domain/takeoff/quantities.hardware.test.js
node src/domain/takeoff/markupPages.test.js
node src/domain/takeoff/sizes.test.js
node src/domain/takeoff/soccerPavilionAccuracy.test.js
node src/domain/takeoff/expandedCorpusAccuracy.test.js
```
