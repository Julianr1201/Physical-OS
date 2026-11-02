---
name: create-commerce-adapter
description: Adds a Physical OS fulfillment adapter that dispenses once and reports verification separately. Use when connecting a locker, dispenser, or other simulated fulfillment device.
---

# Create a commerce adapter

## Purpose

Add a fulfillment adapter that accepts one command per order and reports whether the product actually moved.

## When to invoke

The task adds a dispenser, locker, or other fulfillment device for commerce.

## Required inputs

- Adapter id and whether it is simulated
- What a successful verification looks like
- How an uncertain result is detected

## Workflow

1. Read `packages/commerce/src/fulfillment.ts` and `docs/architecture/commerce.md`.
2. Implement `execute` and `inspect`. Store the first result under the order idempotency key.
3. Return `duplicate: true` on a second call without performing another physical action.
4. Map `fulfilled`, `failed`, and `uncertain` in `CommerceService.applyFulfillment`.
5. Add a test that an uncertain command cannot be executed twice.
6. Keep the adapter out of `PhysicalSystem.executeCommand` unless the action is an existing low or medium capability.

## Validation criteria

- A retry does not increment the execution count after acceptance
- The order records evidence
- The kiosk shows recovery when payment succeeded and delivery did not

## Expected outputs

The adapter, the service branch, and the test result.

## References

- `packages/commerce/src/fulfillment.ts`
- `.cursor/rules/physical-fulfillment.mdc`
