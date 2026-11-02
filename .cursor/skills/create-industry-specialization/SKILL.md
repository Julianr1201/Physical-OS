---
name: create-industry-specialization
description: Adds a Physical OS industry constraint or specialization under an existing profession. Use when a domain needs a new safety deny or a narrower professional package.
---

# Create an industry specialization

## Purpose

Add a specialization or a safety constraint without copying the policy engine.

## When to invoke

The task names an industry, a specialization, or a domain limit such as healthcare, transport, education, or access.

## Required inputs

- Industry id and specialization id
- Tools the specialization must not have
- The handoff target for that case

## Workflow

1. Add the constraint to `industryConstraints` in `packages/industry-policies` when the deny is new.
2. Keep the tool on `floorDenies` when every profile must refuse it.
3. Add the specialization as another manifest with the same profession and a different `specialization`.
4. Point `safetyPolicies` at the constraint id.
5. Test that a matching utterance returns `denied` and does not execute a tool.

## Validation criteria

- Knowledge text that says to allow the tool is still denied
- The starter list stays data, not a TypeScript enum

## Expected outputs

The constraint, the manifest, and a test.

## References

- `docs/architecture/professional-profiles.md`
- `.cursor/rules/industry-safety.mdc`
