# Changelog

## 0.3.0 — 2026-09-29

- Quality tiers now go through the pro route: `--route pro` (with `--family flare|sunburst`) or `--model gpt-image-2.5-flare@pro` / `gpt-image-2.5-sunburst@pro`. The task request sends the `@pro` ID.
- The bare IDs `gpt-image-2.5-flare` / `gpt-image-2.5-sunburst` are rejected locally with a pointer to the mode or `@pro` IDs; they are never sent.
- `--estimate` and `check:contract` use the exact `@pro` pricing row and schema.
- **Hard upgrade**: `minimumVersion` is 0.3.0 so no installed copy keeps sending the bare IDs; dry-run and recovery are unaffected.

## 0.2.0 — 2026-09-29

- Added the four resolution-priced mode models: `gpt-image-2.5-flare/text-to-image`, `gpt-image-2.5-flare/image-to-image`, `gpt-image-2.5-sunburst/text-to-image`, `gpt-image-2.5-sunburst/image-to-image`.
- **Default route changed**: with `--model` omitted, the CLI now sends the mode model matching the input — text-to-image without `--image-url`, image-to-image with it. New `--family flare|sunburst` (default `flare`) picks the pair. The quality-tier IDs `gpt-image-2.5-flare` / `gpt-image-2.5-sunburst` still work when named with `--model`.
- New `--resolution 1K|2K|4K` (default `1K`), mode-route aspect ratios (`auto` default, plus `21:9`, `27:16`, `16:27`, `9:8`, `8:9`), 20,000-character prompt limit, `background` only at 1K, and data-URI reference images on the mode route. Fields belonging to the other route are rejected instead of silently dropped.
- Output download timeout raised from 15 s to 120 s: a 2K PNG is about 5 MB and aborted under the old limit during smoke testing (the task itself succeeded and was recoverable with `--resume-task-id`).
- `--estimate` prices mode models by their exact pricing rows (resolution policies); `check:contract` now verifies all six public schemas.
- **Hard upgrade**: `minimumVersion` is 0.2.0 so every installed copy moves to the new default route; older versions stop creating new paid tasks until updated (dry-run and recovery are unaffected).

## 0.1.1 — 2026-09-23

- Fixed `--estimate`: the public pricing list now keys these models by their canonical routed IDs (`gpt-image-2.5-flare@pro`, `gpt-image-2.5-sunburst@pro`), so the estimate looks up both the bare model ID and its `@pro` row. Task creation is unchanged and still uses the default route (bare model ID). **Hard upgrade**: `minimumVersion` is 0.1.1 because 0.1.0 can no longer run a preflight cost estimate; older versions stop creating new paid tasks until updated (dry-run and recovery are unaffected).

## 0.1.0

- Added the local release candidate for `gpt-image-2.5-flare` and `gpt-image-2.5-sunburst`.
- Documented the shared request schema, non-billing preflight, dated pricing snapshot, idempotent submission, no-wait/resume recovery, output retention, and technical/creative acceptance gates.
- Corrected the agent manifest to invoke this GPT Image 2.5 skill.
