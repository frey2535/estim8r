# Current Flow Product Entitlements

Current Flow authentication and product ownership are intentionally separate.

## Access model

1. A user signs into a Current Flow identity.
2. The identity resolves to an individual profile and optionally an organization.
3. The app checks `product_entitlements` for its own product key.
4. Access is granted only by a current individual or organization entitlement, or platform-admin override.

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

The browser cannot create or modify entitlements. Authenticated clients receive SELECT only. Purchase fulfillment must be performed by a trusted server, Supabase Edge Function, payment webhook, or platform-admin service using privileged credentials.

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
