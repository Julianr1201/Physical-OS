---
name: debug-device-connection
description: Diagnoses a Physical OS simulator or MQTT device that is disconnected, timing out, or not verifying. Use when a command stays delivered or failed.
---

# Debug a device connection

## Purpose

Separate transport failure, policy rejection, and a state read that did not match.

## When to invoke

A device stays offline, a command times out, or the console shows a failure after a click.

## Required inputs

- Device id, adapter id, and the command outcome
- Adapter health from `GET /api/v1/overview` or the integrations screen
- For MQTT, the broker host and whether TLS is enabled. Do not ask for the password in the chat log

## Workflow

1. Read the latest audit entry for the correlation id.
2. If the outcome is `rejected`, read the policy reason before touching the adapter.
3. If the outcome is `timed_out` or the device is disconnected, check simulator faults or the MQTT client health.
4. Confirm the state topic payload matches the capability schema. Extra command fields are ignored; invalid JSON is rejected.
5. Confirm plaintext MQTT is only used on localhost.
6. After a fix, re-run the adapter test or the API journey and compare `verified`.

## Validation criteria

- The reported outcome matches the audit entry
- A timeout did not change observed state
- The password was not printed

## Expected outputs

The failing boundary, the evidence, and the test that now covers it.

## References

- `docs/architecture/adapter-sdk.md`
- `packages/adapter-mqtt/src/index.ts`
- `packages/adapter-simulator/src/index.ts`
