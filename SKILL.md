---
name: hiapi-gpt-image-2-5
description: Use only for HiAPI GPT Image 2.5 image generation and editing with Flare or Sunburst — the mode model IDs gpt-image-2.5-flare/text-to-image, gpt-image-2.5-flare/image-to-image, gpt-image-2.5-sunburst/text-to-image, gpt-image-2.5-sunburst/image-to-image (default), or the pro route gpt-image-2.5-flare@pro / gpt-image-2.5-sunburst@pro for quality tiers. Covers text-to-image, image-to-image, schema validation, dry-run estimates, idempotent async creation, polling, resume, and output download. Do not invoke for GPT Image 2, other GPT Image versions, or unrelated image models.
---

# HiAPI GPT Image 2.5

This released 0.3.1 skill wraps HiAPI's unified async image API for six GPT Image 2.5 model IDs in two routes:

- **Mode route (default).** When `--model` is omitted, the CLI selects `gpt-image-2.5-<family>/text-to-image` without reference images and `gpt-image-2.5-<family>/image-to-image` with them. `--family` is `flare` by default; use `sunburst` only when the caller asks for Sunburst. Priced per image by `resolution` (`1K`/`2K`/`4K`).
- **Pro route (`--route pro`).** `gpt-image-2.5-flare@pro` or `gpt-image-2.5-sunburst@pro`, used only when the caller asks for pro, quality tiers, or a PNG/JPEG/WebP output choice. Priced per image by `quality`.

Never send the bare IDs `gpt-image-2.5-flare` or `gpt-image-2.5-sunburst`; the CLI rejects them.

Each accepted task produces one image. Do not infer a quality, speed, or visual advantage between Flare and Sunburst or between the routes.

## Required sequence

1. Decide whether the request is text-to-image (no `--image-url`) or image-to-image/editing (1–16 `--image-url` values). The mode route accepts public HTTP(S) URLs or `data:image/png|jpeg|webp;base64,` URIs; the pro route accepts public HTTP(S) URLs only. Local file paths are not uploaded.
2. Validate the prompt and options locally. All six model IDs require a non-empty prompt of at most 8,000 UTF-16 code units after trimming surrounding whitespace (JavaScript `string.length`; astral emoji count as two). Run `--dry-run --estimate` before a paid create. The estimate reads the current `/api/pricing` snapshot and creates no task. The CLI rejects fields that belong to the other route (`--quality`/`--output-format` on the mode route, `--resolution` on the pro route) and `--background` with resolution 2K/4K.
3. Submit once with a stable `--idempotency-key`. The CLI prints the key and task ID to stderr immediately after acceptance. If acceptance is ambiguous, reuse the same key; never blind-retry with a new key.
4. Use the default wait, or `--no-wait` to return after submission. Use `--resume-task-id` to poll/download an existing task without creating another task. Use `--no-save` when you only need the output URL.
5. Keep the downloaded image through technical and creative checks. Treat temporary output URLs as expiring.

Read [references/api.md](references/api.md) for the field contract, [references/workflow.md](references/workflow.md) for delivery and QC, and [references/output.md](references/output.md) for response handling and recovery.

## Safety boundary

`--dry-run`, `--estimate`, and local validation are non-billing. Creating a task may spend account balance. Callbacks and HiAPI persistent storage are not implemented as CLI flags in this package; use the direct API snippets in the references when those features are enabled for the account.
