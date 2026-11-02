---
name: create-automation
description: Adds a deterministic Physical OS automation using the versioned JSON schema. Use when defining a trigger, condition, or device action rule.
---

# Create an automation

## Purpose

Add a rule the automation engine can run without the intelligence package.

## When to invoke

The task asks for a when/if/then behavior, a schedule, or a change to condition evaluation.

## Required inputs

- Trigger event, interval, or signal
- Conditions and the devices they read
- Actions and their capabilities
- Cooldown and whether a dry run is required

## Workflow

1. Draft the definition against `automationSchema` in `packages/shared`.
2. Reject any high-risk action before save. The core already does this; add a test if you add a new action kind.
3. Evaluate conditions in `packages/automation-engine` with a fixture clock.
4. Confirm self-caused events are skipped and depth stops at 3.
5. Seed the rule only when it belongs to the simulated home, and label that home as simulation.
6. Run the engine test and, for a user-visible rule, the server integration test.

## Validation criteria

- Invalid definitions fail Zod parsing
- A dry run records the decision and does not call the adapter
- The sunset behavior uses the `after_sunset` signal, not a location

## Expected outputs

Schema or engine change, tests, and the automation visible in the console when it is user-facing.

## References

- `docs/architecture/event-flow.md`
- `packages/automation-engine/src`
- `examples/simulated-home/home.json`
