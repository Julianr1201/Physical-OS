# Contributing

Physical OS accepts changes that keep the core local, typed, and safe to run on a machine that controls real devices later.

1. Read `AGENTS.md` and `docs/security/safety-policy.md`.
2. Keep a change inside the package that owns the behavior.
3. Validate external input with Zod at the boundary.
4. Add or update a Vitest test.
5. Run `pnpm typecheck`, `pnpm lint`, and `pnpm test`.
6. Do not mark a planned integration as implemented.

Report security issues privately. See `SECURITY.md`.

By contributing, you agree that your contribution is licensed under Apache-2.0.
