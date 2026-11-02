---
name: tv-accessibility-audit
description: Reviews a Physical OS television change for focus, names, contrast, and reduced motion. Use when a TV screen or overlay changes.
---

# TV accessibility audit

## Purpose

Check that the television can be used without a pointer and without surprise motion.

## When to invoke

A change touches focus, a dialog, or television CSS.

## Required inputs

- The component or stylesheet diff

## Workflow

1. Confirm every control has a visible name and a focus ring using `--accent-primary`.
2. Walk arrows across rows, including the last item in a row.
3. Open and close each dialog with Escape. Focus must return.
4. Confirm `prefers-reduced-motion` disables the tile scale.
5. Check that status text is not only a color dot.
6. Note any target that is too small for a 1920×1080 television.

## Validation criteria

- No focus trap
- No control that only appears on hover
- Reduced-motion rule present

## Expected outputs

A short list of gaps, or a statement that the walk found none.

## References

- `apps/console/src/app/globals.css`
- `apps/console/src/lib/spatial.test.ts`
