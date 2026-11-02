---
name: design-system-review
description: Reviews a Physical OS interface change against the television tokens and the separate settings palette. Use when adding color, type, or a new screen.
---

# Design system review

## Purpose

Keep the television and the settings area visually separate and consistent.

## When to invoke

The task introduces color, type, spacing, or a new screen in `apps/console`.

## Required inputs

- The screen: home or settings
- The elements that changed

## Workflow

1. If the screen is the home, use `.tv` tokens, Inter, and Manrope. Hero type stays within 48–72px.
2. If the screen is settings, keep paper, ink, brass, pine, and clay.
3. Reject a new gradient, neon accent, or glass panel.
4. Check English and Spanish strings.
5. Check overscan padding still uses `clamp`.

## Validation criteria

- Home and settings do not share a chrome
- Tokens come from the existing variables
- Simulated content is named as such

## Expected outputs

The review note and any token that was corrected.

## References

- `.cursor/rules/physical-design-system.mdc`
- `.cursor/rules/06-ui-design-system.mdc`
- `docs/product/tv-experience.md`
