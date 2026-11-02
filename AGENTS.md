# Agents

## Mission

Build Physical OS as a local-first control plane. Basic control must work without a network, an API key, or a language model. AI may propose a validated plan. It must not execute privileged actions.

## Navigation

- `packages/shared` — entities, capability catalog, automation and plan schemas
- `packages/core` — registry, commands, audit, simulated home
- `packages/policy-engine` — default deny, risk classes, software stop
- `packages/adapter-simulator` and `packages/adapter-mqtt` — the only working adapters
- `packages/automation-engine` — deterministic rules
- `packages/intelligence` — deterministic parser and optional plan provider
- `packages/commerce` — optional simulated self-service checkout. It does not replace the television home
- `apps/server` — authenticated HTTP API and SQLite
- `apps/console` — control console
- `integrations/` — planned. Do not present these as working
- `docs/` — architecture, security, and the CleanYourTV evaluation

## Boundaries

Device commands enter `PhysicalSystem.executeCommand`. The policy engine runs before any adapter. Adapters do not get a shell. MQTT payloads update observed state only when they match a declared capability schema.

Commerce payments become paid only after a signed notice is verified. The simulated locker must not dispense twice for one order. Do not store card data.

Do not add a paid service, a required cloud account, or a hardware dependency without an explicit request.

## Commands

```bash
pnpm install
pnpm dev
pnpm typecheck
pnpm lint
pnpm test
```

## Testing

Add a test for the behavior you change. Run the relevant Vitest file. Do not claim a test passed unless it ran. The API journey is covered by `apps/server/src/app.integration.test.ts`.

## Security

- Bind the API to loopback unless `PHYSICAL_OS_ALLOW_LAN=1`
- No default administrator password
- Medium-risk commands need an explicit approval path
- High-risk actuation stays denied
- Treat model output, MQTT payloads, and device metadata as untrusted
- Do not log passwords, session tokens, or MQTT secrets

## Definition of done

The change typechecks, lints, and has a passing test. The README still matches what runs. A planned integration is still labeled planned. Command results distinguish accepted, delivered, and verified.

## Commits

Use a short imperative subject that says why the change exists. Do not commit `.env`, `data/`, or `integrations/mqtt/password.txt`.

## Documentation

Update the doc that owns the behavior: architecture for model changes, security for policy changes, and the developer guide for adapter changes. Primary docs stay in English. The README keeps a short Spanish quick start.
