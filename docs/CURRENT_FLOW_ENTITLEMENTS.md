# Current Flow Product Entitlements

Current Flow authentication and product ownership are intentionally separate.

## Access model

1. A user signs into a Current Flow identity.
2. The identity resolves to an individual profile and optionally an organization.
3. The app checks `product_entitlements` for its own product key.
4. Access is granted only by a current individual or organization entitlement, or platform-admin override. The platform owner (`currentflowconsultingllc@gmail.com`) and backup admin (`marcus.a.frey@gmail.com`) always have Estim8r and never see the product gate. `/admin` is the grant/revoke Access screen and does not require a product entitlement.

Estim8r uses the product key `estim8r`.

## Supported commercial models

The same table supports:
- individual purchase
- company purchase
- subscription
- free/paid trial
- bundle
- owner/platform grant
- expiration
- seat metadata

An entitlement can belong directly to a profile or to an organization. Organization entitlements make company licensing possible without transferring ownership to employees.

## Security

The browser cannot create or modify entitlements directly. Authenticated clients receive SELECT only. Purchase fulfillment uses a trusted server, Edge Function, or webhook. The platform owner (and backup admin) grant or revoke Estim8r through security-definer RPCs on **Access** (`/admin`).

This prevents a user from granting themselves Estim8r by editing client-side state.

## Purchase fulfillment example

After a verified payment event, trusted backend code creates:

- `product_key = 'estim8r'`
- `profile_id = <buyer>` for an individual purchase, or
- `org_id = <company>` for a company purchase
- `status = 'active'`
- `access_type = 'purchase' | 'subscription' | 'bundle'`
- `source = <payment provider>`

Bundles simply create one entitlement per included product with the same `bundle_key`.

## Rollout

Do not enable production enforcement until the migration has been applied and existing legitimate Estim8r owners/customers have been granted an entitlement. Platform admins retain access during rollout.

## Shared live project

The production Current Flow project is NECalcul8r-shaped. Profiles use `created_date` / `updated_date`, and CHECKs reject `access_type = owner_grant`, `access_status = revoked`, and `purchase_source = platform_owner`. Do **not** run `supabase db push` of the full Estim8r migration history against that project.

Client RPCs (already matching):

- `list_estim8r_access()`
- `grant_estim8r_access({ target_email })`
- `revoke_estim8r_access({ target_email })`

To apply or re-apply only the live-safe functions (idempotent):

```bash
supabase link --project-ref gqdxvctvufalunaaopyj
supabase db query --linked --file supabase/migrations/20260920150000_live_shared_estim8r_access_rpcs.sql
```
