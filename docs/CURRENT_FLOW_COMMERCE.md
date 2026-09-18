# Current Flow Commerce Architecture

Pricing is intentionally configuration, not application logic.

## Separation of concerns

Current Flow uses four independent layers:

1. **Identity** — who the user is and which company they belong to.
2. **Catalog** — which products/plans are currently offered and at what price.
3. **Commerce events** — what a payment provider says was purchased, renewed, cancelled or refunded.
4. **Entitlements** — what the user/company is actually allowed to use.

Estim8r only needs to know whether the authenticated account has a valid `estim8r` entitlement. It does not need to know whether that access came from a one-time purchase, monthly plan, annual plan, company license, trial or bundle.

## Why this remains flexible

The `product_plans` catalog supports:
- one-time purchase
- monthly subscription
- annual subscription
- trial
- custom/manual commercial terms
- individual licensing
- company licensing
- seat ranges
- bundles
- payment-provider price IDs

Prices are stored as integer minor currency units (for USD, cents), avoiding floating-point money errors.

Nothing in the app hardcodes an Estim8r price.

The initial `estim8r_default` plan is deliberately inactive, private and has no price. It exists only as a stable catalog placeholder until pricing is decided.

## Provider independence

`purchase_events` is provider-neutral. Stripe, Google Play, Apple App Store or another provider can all feed the same fulfillment layer.

Provider-specific transaction/subscription/customer IDs are stored for reconciliation, while the app continues to consume the same Current Flow entitlement model.

## Fulfillment contract

A trusted backend receives and verifies a provider event, records it idempotently in `purchase_events`, then creates/updates/revokes the appropriate `product_entitlements`.

The browser never fulfills its own purchase.

### Successful purchase
- verify provider event
- resolve Current Flow profile/company
- resolve product/plan
- record purchase event
- create/update entitlement
- mark event processed

### Renewal
- record event
- extend/maintain entitlement

### Cancellation
- record event
- preserve access through paid-through date if appropriate

### Refund/revocation
- record event
- update entitlement according to commercial policy

## Pricing decisions can be made later

Before launch, pricing can be configured as catalog data without rewriting the entitlement gate. For example, Estim8r could later become:
- $X one-time individual
- $X/month individual
- $X/year individual
- company plan with Y seats
- tiered company seats
- part of a Current Flow contractor bundle

Those are catalog/payment configuration decisions, not architecture changes.
