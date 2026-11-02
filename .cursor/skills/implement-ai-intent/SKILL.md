---
name: implement-ai-intent
description: Extends the deterministic intent parser or the validated plan path. Use when adding a natural-language command or changing plan approval.
---

# Implement an AI intent

## Purpose

Recognize one more operator sentence, or tighten how model output becomes a plan, without letting a model execute anything.

## When to invoke

The task adds a phrase, a Spanish variant, or a provider response field.

## Required inputs

- Example utterances, including one that should stay unrecognized
- Target devices and capabilities
- Whether the result is a read or a plan that needs approval

## Workflow

1. Add the phrase to the deterministic parser in `packages/intelligence` before considering a provider.
2. Return a structured plan or a read. Do not return code or a shell string.
3. Add a case that appends extra instructions and still returns unrecognized.
4. If the provider path changes, rebuild steps with `parseAction` and reject the plan when any step fails.
5. Keep approval in front of `approvePlan`.
6. Update `docs/architecture/intelligence.md` with the new phrase.

## Validation criteria

- The phrase works with no `PHYSICAL_OS_LLM_*` variables
- A malformed model plan is rejected
- The audit trail shows who approved execution

## Expected outputs

Parser or provider change, unit tests, and the intelligence doc update.

## References

- `docs/architecture/intelligence.md`
- `.cursor/rules/05-ai-agent-security.mdc`
- `packages/intelligence/src/index.ts`
