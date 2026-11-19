# Changelog

## 0.4.0 — 2026-11-19

- Follows the new production `@pro` contract, verified against `https://api.hiapi.ai/api/models/content?name=gpt-image-2.5-flare@pro` and `https://api.hiapi.ai/api/pricing`:
  - `aspect_ratio` is now a pattern of 15 ratios (`1:1`, `3:2`, `2:3`, `4:3`, `3:4`, `5:4`, `4:5`, `16:9`, `9:16`, `2:1`, `1:2`, `21:9`, `9:21`, `3:1`, `1:3`) plus an exact `WxH` pixel size; `auto` is rejected locally and no longer sent.
  - `quality` has five values (`low`, `medium`, `high`, `xhigh`, `max`); `auto` is rejected locally.
  - `--resolution 1K|2K|4K` (default `1K`) is now accepted on the pro route and written to `input.resolution`.
  - `framing` is a server-computed billing tier: never sent, and `--framing` is rejected locally with a pointer to the server derivation.
  - `--estimate` derives `framing` and the billed resolution tier locally (long side ÷ short side: square < 1.3, standard 1.3–2, panorama > 2; WxH bills by total pixels, and a ratio whose long side is capped at 3840 at 4K bills as 2K) and matches the 45-cell `{framing, quality, resolution}` rule set from live pricing. No prices are hard-coded.
- `checkLiveContract` now asserts the live `@pro` shape: the size pattern, no size enum, `quality` five values, `resolution` enum with default `1K`, and `framing` hidden/server-computed.
- `tests/fixtures/gpt-image-2-5-schemas.json` carries the 2026-11-19 live `@pro` schemas; the mode schemas are unchanged.
- Docs, `llms.txt`, and the API reference now describe the three-factor `@pro` pricing and replace the stale per-quality price snapshot with a dated framing × quality × resolution table.
- **Soft upgrade**: `latestVersion` is 0.4.0 and `minimumVersion` remains 0.3.1. Older copies still create valid default `@pro` tasks and unaffected mode-route tasks; their defects are rejecting `--resolution`, accepting the now-invalid `auto` values locally, and missing the three-key price match.

## 0.3.3 — 2026-11-07

- Read the public no-key pricing and model metadata from `https://api.hiapi.ai`. `DEFAULT_SITE_URL` now points at the API host, which keeps `--estimate` and the live contract check working; `https://www.hiapi.ai/api/...` now redirects to `https://hiapi.ai/api/...` and returns 404.
- **Soft upgrade**: `latestVersion` is 0.3.3 and `minimumVersion` remains 0.3.1.

## 0.3.2 — 2026-10-23

- Raised the local prompt limit from 8,000 to 20,000 characters on all four mode IDs and both `@pro` IDs, matching the public schema relaxed on 2026-10-13. Prompts of 8,001–20,000 characters are now accepted instead of being rejected locally.
- Documented the two limits separately: the 20,000-character `input.prompt.maxLength` (over-limit requests return `INVALID_REQUEST` with a `maxLength` message) and the separate internal o200k token cap on text-to-image (returns `PROMPT_TOO_LONG`; not applicable to image-to-image).
- Moved the `(default)` marker in the skill description from the Sunburst image-to-image ID to the Flare mode pair, matching the body and the CLI default (`--family flare`).
- Update commands now install into every detected client directory (`$HOME/.claude/skills` and `$HOME/.codex/skills`) instead of only `${AGENT_SKILLS_DIR:-$HOME/.codex/skills}`.
- **Soft upgrade**: `latestVersion` is 0.3.2 and `minimumVersion` remains 0.3.1. Version 0.3.1 sends valid requests and only over-restricts prompt length, so it keeps creating tasks until the user updates.

## 0.3.1 — 2026-10-05

- Unified the prompt limit to 8,000 across all four mode IDs and both `@pro` IDs, matching the public schemas verified on 2026-10-05.
- Retained trimmed JavaScript `string.length` (UTF-16 code unit) validation and added boundary coverage for every route.
- Live contract checks now report actual and expected prompt lengths while retaining all other contract assertions.
- Updated the skill instructions, CLI help, English/Chinese README, and API reference with the shared limit.
- **Hard upgrade**: `latestVersion` and `minimumVersion` are 0.3.1. Older copies must upgrade before new paid creation; preflight and existing-task recovery remain available.

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
