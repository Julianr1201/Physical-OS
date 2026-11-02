---
name: security-threat-model
description: Reviews a Physical OS change for authentication, policy bypass, and untrusted input. Use when a route, adapter, or plan executor changes.
---

# Security threat model

## Purpose

Find whether a change lets an untrusted payload or an unauthenticated caller move a device.

## When to invoke

The change adds a route, stores a secret, parses MQTT or model output, or relaxes a policy decision.

## Required inputs

- The route or parser diff
- What the caller can supply
- Whether the action is low, medium, or high risk

## Workflow

1. Read `docs/security/threat-model.md` and `docs/security/safety-policy.md`.
2. Check the route requires a session, except setup and login.
3. Check the policy engine still sees the command before the adapter.
4. Check secrets are not logged or returned. MQTT passwords stay server-side.
5. Check body size, rate limit, and origin behavior still apply.
6. Add a negative test for the new input.

## Validation criteria

- Unknown actions deny
- High risk stays denied for automations
- The API still binds to loopback by default

## Expected outputs

A short threat note listing the new trust boundary and the test that covers it.

## References

- `docs/security/threat-model.md`
- `apps/server/src/app.ts`
- `packages/policy-engine`
