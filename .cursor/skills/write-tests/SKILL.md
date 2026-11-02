---
name: write-tests
description: Adds Vitest coverage for Physical OS policy, adapters, automations, and the API. Use when a behavior change needs a regression test.
---

# Write tests

## Purpose

Add the smallest Vitest test that fails before the fix and passes after it.

## When to invoke

A behavior change in packages or the server does not yet have a test.

## Required inputs

- The function or route
- One success case and one rejection case
- Any fixture clock, broker, or temporary database

## Workflow

1. Place the test next to the unit, or extend `apps/server/src/app.integration.test.ts` when the journey crosses HTTP.
2. Build domain objects through the public constructors and schemas.
3. Assert `outcome` and `verified` for commands.
4. Use `mkdtemp` for SQLite and remove it in a `finally` block.
5. For MQTT, use the in-process broker pattern in the adapter test. Do not require Docker.
6. Run the file with `pnpm exec vitest run` and report the count you observed.

## Validation criteria

- The new test fails if the assertion is inverted
- No test reads `./data`
- The command you ran and its result are in the task summary

## Expected outputs

The test file and the Vitest result.

## References

- `.cursor/rules/07-testing-quality.mdc`
- `packages/core/src/system.test.ts`
- `apps/server/src/app.integration.test.ts`
