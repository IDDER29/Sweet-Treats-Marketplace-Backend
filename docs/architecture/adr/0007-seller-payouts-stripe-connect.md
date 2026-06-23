# ADR-0007: Seller payouts with Stripe Connect

- Status: Accepted (scaffolded; live integration pending a Connect-enabled Stripe account)
- Date: 2026-06

## Context

The platform takes customer payments today (`PaymentModule`, Stripe Payment
Intents), but the marketplace also has to pay **sellers** — split each order
between the seller and a platform commission, move money to the seller's bank,
and handle refunds/disputes without bespoke ledgering or money-transmission
licensing. We need the lowest-liability path that still supports a per-order fee.

## Decision

Use **Stripe Connect** with **Express** connected accounts and **destination
charges**.

- **Express accounts** — Stripe hosts onboarding (KYC, bank details) and the
  payout dashboard. The platform never touches bank/PII, minimizing PCI/KYC
  burden. (Standard = seller has a full Stripe account, less platform control;
  Custom = most control, but the platform owns all compliance/liability.)
- **Destination charges** — the customer is charged on the **platform** account;
  `transfer_data.destination` routes the seller's share to their connected
  account and `application_fee_amount` keeps the platform commission, in one
  atomic charge. The charge, refunds, and disputes all live on the platform
  account (one place to reconcile). Stripe runs the seller payout schedule, so
  there is **no payout job to build or reconcile** — the `payouts` queue in
  ADR-0003 is reserved only for future batch/edge cases.
- **Fee** — `PLATFORM_FEE_PERCENT` (default 10%) + `PLATFORM_FEE_FIXED_MINOR`,
  computed in minor units and clamped to `[0, gross]`
  (`PayoutsService.computeApplicationFee`).

### Data & flow

- `Business.stripeAccountId` (acct_…) + `Business.payoutsEnabled`, set from
  `account.updated` webhooks (`charges_enabled && payouts_enabled`).
- `POST /payouts/onboarding-link` creates/reuses the Express account and returns
  a one-time onboarding URL.
- At checkout, `PaymentService` merges `PayoutsService.destinationChargeParams()`
  into the PaymentIntent **iff** the seller is payout-enabled; otherwise checkout
  for that seller is blocked (no silent platform-only capture).

## Consequences

- **Refunds/disputes**: refund with `reverse_transfer: true` (and
  `refund_application_fee` per policy) so the seller's share is clawed back. A
  dispute debits the platform; recover from the seller's balance or future
  transfers. *Refund-after-payout* (seller balance already withdrawn) can create
  a negative balance — handle via Stripe's debit or a hold policy. **Open.**
- **Onboarding gating**: products can be listed before onboarding, but checkout
  is blocked until `payoutsEnabled`. Surface status in the seller dashboard.
- **Webhooks**: must verify signatures and process idempotently (the existing
  `@SkipThrottle` webhook + Idempotency patterns apply). New events:
  `account.updated`, `charge.refunded`, `charge.dispute.*`,
  `transfer.*`/`payout.*` for reporting.
- **Tax/VAT, multi-currency, statements/1099-KYC**: out of scope here; Stripe Tax
  + Connect reporting cover these when needed. **Open.**

## Status of implementation

Scaffolded and unit-tested: fee/split math and `destinationChargeParams` gating
(`PayoutsService`), the connected-account data model + migration, and the
onboarding endpoint. The Stripe API calls (account/account-link creation, webhook
sync) are implemented but require a live Connect-enabled key to exercise.
