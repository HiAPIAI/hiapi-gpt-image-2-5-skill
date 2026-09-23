# Changelog

## 0.1.1 — 2026-09-23

- Fixed `--estimate`: the public pricing list now keys these models by their canonical routed IDs (`gpt-image-2.5-flare@pro`, `gpt-image-2.5-sunburst@pro`), so the estimate looks up both the bare model ID and its `@pro` row. Task creation is unchanged. Soft upgrade: 0.1.0 still creates tasks and only its estimate fails.

## 0.1.0

- Added the local release candidate for `gpt-image-2.5-flare` and `gpt-image-2.5-sunburst`.
- Documented the shared request schema, non-billing preflight, dated pricing snapshot, idempotent submission, no-wait/resume recovery, output retention, and technical/creative acceptance gates.
- Corrected the agent manifest to invoke this GPT Image 2.5 skill.
