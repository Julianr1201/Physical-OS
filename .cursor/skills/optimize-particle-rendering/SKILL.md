---
name: optimize-particle-rendering
description: Tunes Physical OS point-cloud particle cost for ARM and desktop GPUs. Use when the presence figure drops frames, the particle budget changes, or a render tier is added.
---

# Optimize particle rendering

## Purpose

Keep one instanced point draw inside a frame budget without replacing the figure with a video or a flat sprite.

## When to invoke

The task mentions frame rate, particle count, ARM, television hardware, or the high, medium, and low tiers.

## Required inputs

- The target tier
- Whether a frame rate was measured on this machine
- The particle budget before the change

## Workflow

1. Change `particleBudget` and `chooseTier` in `packages/presence`. A measured rate below 24 fps selects low even when the CPU looks fast.
2. Keep a single instanced draw. Do not create one React object per particle.
3. On low, drop the torso and arms with `sampleFigure(count, { body: false })` and cap the device pixel ratio at 1.
4. Record the frame rate the running page reports. Do not invent a measurement for hardware that was not run.
5. Test the tier selection in `packages/presence/src/presence.test.ts`.

## Validation criteria

- High has more particles than medium, and medium more than low
- The shader stays on the palette `#B5D7D2`, `#DCEAF0`, `#5E859A`, `#E5C89D`
- No bloom or full-screen noise pass is added

## Expected outputs

Tier change, test, and a note in `docs/architecture/presence.md` if the budgets change.

## References

- `docs/architecture/presence.md`
- `.cursor/rules/physical-presence-rendering.mdc`
