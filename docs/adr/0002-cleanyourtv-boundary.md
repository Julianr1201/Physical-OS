# ADR 0002 — CleanYourTV stays a reference

CleanYourTV is a television debloat and launcher project. Physical OS will not vendor it, shell out to it, or open an ADB connection. The evaluation is in `docs/research/cleanyourtv-evaluation.md`.

A future television integration, if requested, starts as read-only discovery or a simulation. It does not disable packages.
