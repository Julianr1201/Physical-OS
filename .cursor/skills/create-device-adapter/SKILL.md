---
name: create-device-adapter
description: Adds a Physical OS device adapter that validates payloads and reports delivery separately from verification. Use when integrating a new transport such as a broker or a simulator.
---

# Create a device adapter

## Purpose

Add an adapter that implements contract version 1 without giving it a shell or a verified-state flag.

## When to invoke

The task asks for a new device transport, or to extend the simulator or MQTT adapter.

## Required inputs

- Transport name and which operations are actually supported
- Payload examples for state and commands
- Whether discovery is explicit configuration or a scan of known addresses

## Workflow

1. Read `packages/adapter-sdk` and one existing adapter.
2. Create the package and a manifest whose `operations` match the methods you implement.
3. Parse inbound data with `parseObserved`. Reject unknown shapes.
4. Implement timeout and correlation id. A timeout must not mutate state.
5. Return delivery from `executeCommand`. Leave verification to the core.
6. Register the adapter in the server and add a health row.
7. Add Vitest cases for a valid command, a rejected payload, and a timeout.
8. Document authentication and network exposure. Mark the integration experimental until the tests pass.

## Validation criteria

- `pnpm typecheck` and the new Vitest file pass
- Topics or addresses come from configuration
- The console does not show the adapter as ready before health is connected

## Expected outputs

The adapter package, registration, tests, and a short developer note.

## References

- `docs/architecture/adapter-sdk.md`
- `docs/developer/creating-adapters.md`
- `packages/adapter-mqtt/src/index.ts`
