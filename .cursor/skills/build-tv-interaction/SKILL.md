---
name: build-tv-interaction
description: Adds a remote-operable Physical OS television control, panel, or overlay. Use when changing focus order, a room control, or the assistant overlay.
---

# Build a TV interaction

## Purpose

Make a control reachable with arrows, Enter, and Escape, and restore focus when a panel closes.

## When to invoke

The task adds a tile, a panel, or a key binding on the television.

## Required inputs

- The row and column of the new target
- The API call it performs
- The focus target to restore on Escape

## Workflow

1. Add a stable `id` and a `FocusItem` with `row` and `col`.
2. Route arrows through `moveFocus`. Leave slider arrows on the slider.
3. Close on Escape and call `restoreFocus`.
4. Give the panel `role="dialog"` and a name.
5. Add a spatial test if the geometry is new.
6. Confirm the action is real. If the platform cannot do it, do not add the control.

## Validation criteria

- Arrow movement matches the test
- Escape returns to the previous target
- A failed command shows the outcome text

## Expected outputs

The interaction, its focus entry, and the test result.

## References

- `apps/console/src/lib/spatial.ts`
- `.cursor/rules/remote-navigation.mdc`
