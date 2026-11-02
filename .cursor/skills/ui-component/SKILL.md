---
name: ui-component
description: Adds a Physical OS console screen or control that calls a real API action. Use when changing the operator interface.
---

# UI component

## Purpose

Add an accessible control that performs a real API action and matches the existing visual tokens.

## When to invoke

The task adds or changes a page, form, or device control in `apps/console` or `packages/ui`.

## Required inputs

- The screen and the API route
- Empty, loading, and error states
- English and Spanish labels

## Workflow

1. Read the current view and `packages/ui` primitives.
2. Use paper, ink, brass, pine, and clay. Do not introduce a gradient.
3. Wire the control to an existing route. Pass `approval: "explicit_ui"` for a direct medium-risk command.
4. Show simulation and planned status with the words already used on those screens.
5. Add both languages in `src/lib/i18n.ts`.
6. Start the console and exercise the control through the API if a browser is unavailable. Say which click path was not run.

## Validation criteria

- The control is keyboard reachable
- A failed request shows the API error
- Planned integrations have no action button

## Expected outputs

The component, copy in both languages, and a note of how it was verified.

## References

- `.cursor/rules/06-ui-design-system.mdc`
- `apps/console/src/components/views.tsx`
- `docs/product/mvp-scope.md`
