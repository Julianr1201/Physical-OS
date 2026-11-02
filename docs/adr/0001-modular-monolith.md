# ADR 0001 — Modular monolith

Physical OS ships as one API process and one console. Packages are libraries, not services. An in-process event bus is enough for one home. A broker, Kubernetes, or a second database would add failure modes the MVP does not need.

SQLite stores the snapshot. The core talks to a `SnapshotStore` interface, which is the port a PostgreSQL implementation would replace. Node's built-in `node:sqlite` is used through Drizzle's SQLite proxy so the MVP does not compile a native module. The module is experimental in Node and that limitation is documented.

Turborepo is not used. `pnpm` recursive scripts and one Vitest config are enough.
