# Roadmap

## Now

Simulated home, deterministic automations, approved natural-language plans, and a configured MQTT broker.

## Next

- Browser end-to-end coverage for the console
- Normalized SQL queries instead of snapshot rewrites, then a PostgreSQL driver behind `SnapshotStore`
- More deterministic phrases, still without giving a model a tool
- A read-only description of a television as a media device, with no ADB write path

## Later, as separate domain packs

Home OS is this MVP. Garden OS, Robot OS, Drone OS and Building OS are not started. They would add capabilities and policies. They would not fork the registry, the event bus, the automation engine, or the audit log.

Robot and drone packs, if they are ever built, need a hardware emergency stop that this software latch does not provide. They stay disabled until that boundary is explicit.
