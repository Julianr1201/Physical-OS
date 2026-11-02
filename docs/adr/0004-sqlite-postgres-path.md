# ADR 0004 — Persistence and PostgreSQL

The MVP writes a versioned JSON snapshot of environments, rooms, devices, automations, commands, audit entries, signals and runtime settings. Accounts and sessions live in their own tables and survive a snapshot save.

Rewriting the domain tables is acceptable at home scale and is not the long-term schema. A later change should normalize those tables and then implement the same `SnapshotStore` methods with PostgreSQL. Application code should not gain a second persistence path before that port exists.

`node:sqlite` prints an experimental warning. Do not switch to a native addon unless Node removes the built-in module or the proxy becomes a measured bottleneck.
