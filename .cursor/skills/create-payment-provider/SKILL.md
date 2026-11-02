---
name: create-payment-provider
description: Adds a Physical OS payment provider that verifies signed notices and never stores card data. Use when extending QR checkout or a certified payment terminal.
---

# Create a payment provider

## Purpose

Add a provider whose paid state comes from a verified server-side notice.

## When to invoke

The task adds a payment method, a callback, or an NFC terminal integration.

## Required inputs

- Provider id and mode (`simulation` or a future live mode)
- The signed payload fields
- Whether NFC is a certified terminal or absent

## Workflow

1. Read `packages/commerce/src/payments.ts` and `.cursor/rules/payment-security.mdc`.
2. Implement `sign` and `verify`. Compare signatures with `timingSafeEqual`.
3. Reject the provider in `assertSimulation` until live verification is implemented and tested.
4. Pass verified notices through `CommerceService.applyCallback`. Deduplicate `providerEventId`.
5. Set `nfc.available` to false unless a certified terminal is actually connected.
6. Add tests for a bad signature, a mismatched amount, and a duplicate notice.

## Validation criteria

- The client cannot set `PAID` by itself
- No card number is stored or logged
- The kiosk copy says the flow is simulated when the provider is simulated

## Expected outputs

The provider, the callback route, and the tests that passed.

## References

- `packages/commerce/src/payments.ts`
- `apps/server/src/commerce-routes.ts`
