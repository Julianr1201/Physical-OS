---
name: test-self-service-flow
description: Tests a Physical OS kiosk purchase from catalog through verified payment, fulfillment, and receipt. Use when changing checkout, QR payment, or dispenser recovery.
---

# Test the self-service flow

## Purpose

Prove a customer can buy a simulated item and that a failed delivery does not charge twice or dispense twice.

## When to invoke

The task changes `packages/commerce` or `/api/v1/commerce`.

## Required inputs

- The order path under test
- The expected final state

## Workflow

1. Create a `CommerceService` with a fixed clock.
2. Check out one catalog line and assert the total comes from the catalog.
3. Reject an unsigned body.
4. Complete `simulatePayment` and assert `FULFILLED`, one dispenser execution, and a simulated receipt.
5. Add a case for expiry, dispenser rejection plus refund, or an uncertain result that does not dispense again.
6. Run `pnpm exec vitest run packages/commerce/src/commerce.test.ts` and the server commerce test when the route changed.

## Validation criteria

- `paymentVerified` is true only after the signed path
- Stock returns when the session expires or the refund completes before delivery
- The test output was observed in this session

## Expected outputs

The test file and the Vitest summary.

## References

- `packages/commerce/src/commerce.test.ts`
- `apps/server/src/app.integration.test.ts`
