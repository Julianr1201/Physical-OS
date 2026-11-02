---
name: test-professional-agent
description: Tests a Physical OS professional profile turn, handoff, and profile switch. Use when changing concierge, sales, tutor, or another installed profession.
---

# Test a professional agent

## Purpose

Prove one profile answers, proposes, or hands off, and that another profile can replace it on the same device.

## When to invoke

The task changes a profile turn, a permission grant, a checkout, or profile activation.

## Required inputs

- Profile id
- One utterance that should answer, one that should hand off or be denied
- Whether a device proposal or a checkout is expected

## Workflow

1. Install the profile with `ProfileHost` or `ProfileRegistry` in simulation.
2. Activate it only with the full `requiredPermissions` list.
3. Assert a device proposal has `executed: false`.
4. Assert a checkout order is `AWAITING_PAYMENT` and `dispenseVerified` is false before payment.
5. Assert an education identity request is denied and does not appear in the audit summary.
6. Activate a second profile on device `console` and assert `resolve` returns the new id.
7. Run the package Vitest file and `apps/server/src/profiles.integration.test.ts` when the route changes.

## Validation criteria

- The disclosure is present
- Switching profiles does not construct a second server
- A missing signature is rejected in production mode

## Expected outputs

A passing profile test.

## References

- `docs/architecture/professional-profiles.md`
- `.cursor/rules/embodied-agent-behavior.mdc`
- `.cursor/rules/profile-permissions.mdc`
