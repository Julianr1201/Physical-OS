---
name: release-readiness
description: Checks that a Physical OS change is safe to merge and that the README matches what runs. Use before calling the MVP or a feature done.
---

# Release readiness

## Purpose

Confirm the repository installs, the tests that were run actually passed, and unfinished work is still labeled unfinished.

## When to invoke

The task is about to be called complete, or a release note is being written.

## Required inputs

- The commands you can run locally
- The README claims you intend to make

## Workflow

1. Run `pnpm typecheck`, `pnpm lint`, and `pnpm test`.
2. Run `pnpm --filter @physical-os/console build`.
3. Read the README and remove any claim the commands did not exercise.
4. Confirm high-risk actuation is still denied and the API defaults to loopback.
5. Confirm `integrations/*` READMEs still say planned where no adapter exists.
6. Do not create a git commit unless the user asked.

## Validation criteria

- Each command’s exit code was observed in this session
- No secret file is staged
- Playwright is not described as passing

## Expected outputs

A checklist with commands, exit results, and any remaining gap.

## References

- `AGENTS.md`
- `docs/product/mvp-scope.md`
- `SECURITY.md`
