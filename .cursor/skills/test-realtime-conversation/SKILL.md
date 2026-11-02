---
name: test-realtime-conversation
description: Tests Physical OS turn-taking, interruption, and speech fallbacks. Use when changing microphone input, speech synthesis, barge-in, or the presence conversation flow.
---

# Test a realtime conversation

## Purpose

Prove a conversational turn can be interrupted and that missing speech engines stay unavailable.

## When to invoke

The task changes recognition, synthesis, voice activity, plan confirmation, or cancellation.

## Required inputs

- The utterance or the plan reply
- Whether the browser provider is present
- The expected state after an interrupt

## Workflow

1. Drive `reduceTurn` with a fixed generation. Do not call a live microphone from the test.
2. Assert a late reply is ignored and that speech cancellation is requested.
3. Assert an in-flight approval ignores interrupt.
4. Assert `acceptProvider(null, ...)` stays unavailable. Do not stub a fake transcript.
5. Assert `lineForExecution` uses `pleased` only when every command is `verified`.
6. Run `packages/presence/src/presence.test.ts`.

## Validation criteria

- Typed input still reaches interpret when recognition is absent
- Confirm and cancel call the existing approve and reject routes
- The camera remains off unless the privacy model enables it

## Expected outputs

A passing presence test and, if the route contract changes, a note in `docs/architecture/presence.md`.

## References

- `docs/architecture/presence.md`
- `.cursor/rules/physical-presence-behavior.mdc`
- `.cursor/rules/physical-presence-privacy.mdc`
- `packages/intelligence`
