---
name: create-presence-animation
description: Adds a Physical OS presence state, expression, gaze, or gesture. Use when changing the conversational figure, facial animation, lip sync, or the behavior state machine.
---

# Create a presence animation

## Purpose

Add one visual behavior to the point-cloud figure without bypassing the turn model.

## When to invoke

The task changes idle, listening, speech, a facial expression, gaze, a blink, or an upper-body gesture.

## Required inputs

- The presence state and the expression name
- Whether the mouth is driven by speech boundaries or by the silent gesture preview
- The performance tier that must still render

## Workflow

1. Map the state in `visualFor` inside `packages/presence`. Keep idle `neutral` and the mouth closed.
2. Add the transition to `reduceTurn` and ignore stale generations.
3. If the shader needs a new channel, add it to `sampleFigure` and the instanced attributes.
4. Drive real lip sync from synthesis boundaries only when `speechSynthesis` exists. Use `gestureMouth` only for the labeled silent preview.
5. Add a unit test for the pose and the transition. Run `packages/presence/src/presence.test.ts`.

## Validation criteria

- The figure is drawn from sampled points, not a video
- Gaze changes across states
- `pleased` is not the idle expression
- Device actions still go through interpret and approve

## Expected outputs

Behavior or shader change, a passing presence test, and an update to `docs/architecture/presence.md` when the state list changes.

## References

- `docs/architecture/presence.md`
- `.cursor/rules/physical-presence-rendering.mdc`
- `.cursor/rules/physical-presence-behavior.mdc`
