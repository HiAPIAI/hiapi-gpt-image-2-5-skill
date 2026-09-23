# Changelog

## 0.1.1 — 2026-09-23

- Fixed `--estimate`: the public pricing list now keys these models by their canonical routed IDs (`gpt-image-2.5-flare@pro`, `gpt-image-2.5-sunburst@pro`), so the estimate looks up both the bare model ID and its `@pro` row. Task creation is unchanged and still uses the default route (bare model ID). **Hard upgrade**: `minimumVersion` is 0.1.1 because 0.1.0 can no longer run a preflight cost estimate; older versions stop creating new paid tasks until updated (dry-run and recovery are unaffected).

## 0.1.0

- Added the local release candidate for `gpt-image-2.5-flare` and `gpt-image-2.5-sunburst`.
- Documented the shared request schema, non-billing preflight, dated pricing snapshot, idempotent submission, no-wait/resume recovery, output retention, and technical/creative acceptance gates.
- Corrected the agent manifest to invoke this GPT Image 2.5 skill.
