---
name: architecture-review
description: Reviews a Physical OS change for module boundaries, command outcomes, and persistence. Use when adding a package, a route, or a cross-module call.
---

# Architecture review

## Purpose

Check that a change stays inside the modular monolith and does not treat HTTP success as device verification.

## When to invoke

A change touches more than one of `apps/console`, `apps/server`, and `packages/*`, or adds a new persistence path.

## Required inputs

- The diff or the files the change will edit
- The user-visible behavior

## Workflow

1. List the packages that import the changed code.
2. Confirm the console talks to the API and does not import `@physical-os/core`.
3. Confirm device writes go through `executeCommand` or an audited core method.
4. Confirm a new store operation fits `SnapshotStore` or the account tables.
5. Confirm planned integrations stay labeled planned.
6. Write the finding as a short note in the PR or the task summary.

## Validation criteria

- No new network service
- `verified` is set only after a state read
- SQLite remains behind `AppDatabase`

## Expected outputs

A short review with boundary violations, or a statement that none were found, plus the files checked.

## References

- `docs/architecture/overview.md`
- `docs/adr/0001-modular-monolith.md`
- `docs/adr/0003-command-outcomes.md`
