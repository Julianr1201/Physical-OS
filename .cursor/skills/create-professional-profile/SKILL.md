---
name: create-professional-profile
description: Adds a versioned Physical OS professional profile manifest. Use when creating a profession, a starter profile, or a signed profile package.
---

# Create a professional profile

## Purpose

Add one installable profession without a new application or a closed enum.

## When to invoke

The task adds a profession, a profile manifest, or a package field.

## Required inputs

- Industry, profession, and specialization
- Tools and the permissions they need
- The safety policy ids
- The handoff target

## Workflow

1. Add a seed in `packages/professional-profiles/src/catalog.ts`, or build a manifest with `starterTemplate`.
2. Parse it with `profileManifestSchema`. Keep `schemaVersion` at 1.
3. Set `presencePreset` and `voicePreset` to approved ids. Do not use the profile id as the figure.
4. Run `validateTools`. A denied tool must not ship.
5. Cover install, a turn, and a handoff or a denial in a Vitest file.
6. Update `docs/architecture/professional-profiles.md` if the manifest fields change.

## Validation criteria

- The disclosure says the speaker is an AI professional
- Activation fails until every required permission is accepted
- Device effects stay proposals

## Expected outputs

A manifest, a test, and the catalog entry when it is a starter.

## References

- `docs/architecture/professional-profiles.md`
- `.cursor/rules/professional-profiles.mdc`
- `packages/profile-sdk`
