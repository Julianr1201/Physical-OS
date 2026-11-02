---
name: build-tv-screen
description: Builds a Physical OS television screen that reads real room state and keeps settings separate. Use when changing the home screen, hero, or entertainment rail.
---

# Build a TV screen

## Purpose

Add or change a 16:9 home surface that a person can read from across the room.

## When to invoke

The task changes `apps/console/src/components/tv` or the home route.

## Required inputs

- The room data the screen may show
- Which actions already exist on the API
- Whether the control is level 1 (home), level 2 (a panel), or level 3 (settings)

## Workflow

1. Read `docs/product/tv-experience.md` and `ribbonFor`.
2. Place the change on the home screen only if it is entertainment, the current room, or the assistant entry.
3. Hide a metric when no device in that room has reported it.
4. Send device commands with `approval: "explicit_ui"` and show `verified` separately from `delivered`.
5. Leave inventory, MQTT, and automations on the settings routes.
6. Check type at 1920 and at a narrow companion width.

## Validation criteria

- No preview destination is a button
- Focus is visible without hover
- Copy exists for English and Spanish

## Expected outputs

The screen component and a note of what was exercised.

## References

- `apps/console/src/components/tv/tv-home.tsx`
- `apps/console/src/lib/room-status.ts`
- `apps/console/src/lib/media.ts`
