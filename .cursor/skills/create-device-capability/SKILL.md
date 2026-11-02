---
name: create-device-capability
description: Adds a composable device capability with a risk class and Zod state schema. Use when a device needs a new observable or writable property.
---

# Create a device capability

## Purpose

Add one capability to the shared catalog without hard-coding a device type.

## When to invoke

A device needs a property that is not `on_off`, brightness, a listed sensor, media, or the high-risk setpoint.

## Required inputs

- Capability id
- Read or write
- Risk class and why
- Example observed value

## Workflow

1. Add the Zod schema and catalog entry in `packages/shared/src/capabilities.ts`.
2. Set risk to low for a sensor, medium for a reversible comfort control, high for heat, locks, motion, or flow.
3. Teach `parseAction` and `expectedState` in `packages/device-sdk` when the capability is writable.
4. Add a policy test for allow and deny paths.
5. Expose a control in the console only when the policy allows an operator to use it.
6. Update `docs/architecture/device-model.md`.

## Validation criteria

- Extra JSON fields are rejected
- High risk is denied in the default policy test
- A device can carry the new capability together with an existing one

## Expected outputs

Catalog entry, SDK support, policy test, and the device-model doc update.

## References

- `docs/architecture/device-model.md`
- `docs/security/safety-policy.md`
- `packages/policy-engine`
