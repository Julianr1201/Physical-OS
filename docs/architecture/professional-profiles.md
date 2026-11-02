# Professional profiles

A profession is an installable package. It is not a separate application and it is not a fixed list in the type system. The same presence and the same command pipeline serve every profile.

```text
Industry → Profession → Specialization → Organization deployment → Device instance → Active session
```

## Packages

- `packages/professional-profiles` validates the versioned manifest and ships the starter catalog
- `packages/industry-policies` holds the floor denies. Knowledge text cannot add those tools
- `packages/knowledge-connectors` returns simulated notes with provenance, freshness, and uncertainty
- `packages/human-handoff` matches a handoff cue and records the person who should continue
- `packages/profile-registry` installs, updates, activates, rolls back, and removes a profile
- `packages/profile-runtime` plans a turn. It does not call `executeCommand`
- `packages/profile-sdk` is the third-party entry: schema, template, local simulation, and compatibility

The visual figure and the voice are chosen at activation. They are not the profession. The active role and the disclosure (“I am an AI professional”) travel with the session.

## Trust and permissions

Bundled starters install only when the registry is in simulation. A production registry requires an HMAC signature verified with the operator trust key. An update that adds a permission is rejected until that permission is explicitly accepted. Rollback returns to a version already in the installed history.

## What a turn may do

A turn may answer from an approved source, propose a device utterance, open a simulated checkout, or hand off to a person. A device proposal stays `executed: false` until the existing interpret and approve routes run it. A checkout creates an order through the commerce service and does not dispense before verified payment.

Healthcare profiles do not diagnose or prescribe. Transportation profiles do not drive. Building profiles do not unlock. Education profiles do not store a learner identity. The floor denies apply even when a profile omits them.

## Console

`/profiles` is the onboarding path: industry, profession, specialization, figure and voice, simulated sources, permission review, a test turn, then activation. The television home stays at `/`. The presence shows the active role when one is activated.
