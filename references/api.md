# API contract

This skill sends `POST https://api.hiapi.ai/v1/tasks` with `Authorization: Bearer $HIAPI_API_KEY`, `Content-Type: application/json`, and an `Idempotency-Key` no longer than 255 UTF-8 bytes. `model` is top level; parameters sit inside `input`.

All six model IDs have a public `input.prompt` schema of `minLength: 1`, `maxLength: 8000` (verified 2026-10-05). The CLI retains its existing counting semantics: trim surrounding whitespace, then validate JavaScript `string.length` (UTF-16 code units). BMP characters count as one unit; astral characters such as `😀` count as two. Empty or over-limit prompts are rejected before task creation.

## Model selection

| Flags | `--image-url` | Model sent |
| --- | --- | --- |
| none (`--route mode --family flare` by default) | none | `gpt-image-2.5-flare/text-to-image` |
| none | 1–16 | `gpt-image-2.5-flare/image-to-image` |
| `--family sunburst` | none | `gpt-image-2.5-sunburst/text-to-image` |
| `--family sunburst` | 1–16 | `gpt-image-2.5-sunburst/image-to-image` |
| `--route pro` | optional | `gpt-image-2.5-flare@pro` |
| `--route pro --family sunburst` | optional | `gpt-image-2.5-sunburst@pro` |
| `--model <exact ID below>` | must match a mode ID | that ID |

The bare IDs `gpt-image-2.5-flare` and `gpt-image-2.5-sunburst` are not a supported request route and are rejected locally; use a mode ID or the `@pro` ID. A text-to-image mode ID with `--image-url`, an image-to-image mode ID without it, or a `--route`/`--family` that disagrees with `--model` is also rejected.

## Mode route (default)

Authoritative pages: [Flare text-to-image](https://www.hiapi.ai/docs/models/image/gpt-image-2-5-flare-text-to-image/), [Flare image-to-image](https://www.hiapi.ai/docs/models/image/gpt-image-2-5-flare-image-to-image/), [Sunburst text-to-image](https://www.hiapi.ai/docs/models/image/gpt-image-2-5-sunburst-text-to-image/), [Sunburst image-to-image](https://www.hiapi.ai/docs/models/image/gpt-image-2-5-sunburst-image-to-image/). All four share one schema; image-to-image additionally requires `image_urls`.

```json
{
  "model": "gpt-image-2.5-flare/text-to-image",
  "input": {
    "prompt": "A red apple isolated on a transparent background.",
    "aspect_ratio": "auto",
    "resolution": "1K",
    "background": "transparent"
  }
}
```

| Field | Type | Default | Accepted values / constraint |
| --- | --- | --- | --- |
| `input.prompt` | string | — (required) | 1–8,000 characters |
| `input.image_urls` | string[] | — | image-to-image only, required there: 1–16 JPEG/PNG/WebP, each ≤ 20 MP and ≤ 30 MB, public directly-downloadable HTTP(S) URL or data URI; forbidden for text-to-image |
| `input.aspect_ratio` | enum | `auto` | `auto`, `1:1`, `3:2`, `2:3`, `4:3`, `3:4`, `16:9`, `9:16`, `21:9`, `27:16`, `16:27`, `9:8`, `8:9` |
| `input.resolution` | enum | `1K` | `1K`, `2K`, `4K` |
| `input.background` | enum | none (omitted) | `transparent`, `opaque`, `auto`; allowed only when `resolution` is `1K`. Transparent returns a PNG with alpha — describe an isolated subject with no backdrop or shadow |

There is no `quality`, `output_format`, or `n` on this route. CLI flags: `--family`, `--model`, repeated `--image-url`, `--aspect-ratio`, `--resolution`, `--background`.

## Pro route (`@pro`, quality tiers)

Selected with `--route pro` (plus `--family sunburst` when requested) or `--model gpt-image-2.5-flare@pro` / `--model gpt-image-2.5-sunburst@pro`. The live public schema for each `@pro` ID is checked by `npm run check:contract`; see the [pricing page](https://www.hiapi.ai/en/pricing) for current quality prices.

```json
{
  "model": "gpt-image-2.5-flare@pro",
  "input": {
    "prompt": "A quiet alpine lake at dawn",
    "aspect_ratio": "1:1",
    "quality": "medium",
    "background": "auto",
    "output_format": "webp"
  }
}
```

`input.prompt` is required, 1–8,000 characters. Omit `input.image_urls` for text-to-image; for editing provide 1–16 non-empty public `http://` or `https://` URLs without embedded credentials. Explain the role and order of multiple references in the prompt.

| Field | Type | Default | Accepted values / constraint |
| --- | --- | --- | --- |
| `input.aspect_ratio` | enum | `1:1` | `1:1`, `3:2`, `2:3`, `4:3`, `3:4`, `16:9`, `9:16`, `auto`, `1024x1024`, `1536x1024`, `1024x1536`, `1536x1152`, `1152x1536`, `2048x2048`, `2048x1152`, `1152x2048`, `3840x2160`, `2160x3840` |
| `input.quality` | enum | `medium` | `low`, `medium`, `high`, `xhigh`, `max`, `auto` |
| `input.background` | enum | `auto` | `auto`, `transparent`, `opaque` |
| `input.output_format` | enum | `webp` | `png`, `jpeg`, `webp`; transparency requires `png` or `webp` |

CLI flags: `--route pro`, `--family`, `--model`, repeated `--image-url`, `--aspect-ratio`, `--quality`, `--background`, `--output-format`. `--resolution` is rejected on this route.

## Pricing and estimates

`--estimate` reads `https://www.hiapi.ai/api/pricing` and matches the selected model and input policy. Mode models are listed under their exact IDs and priced by `resolution`; a 2026-09-29 snapshot observed USD/image `1K` 0.05, `2K` 0.08, `4K` 0.12 for all four. The `@pro` models are listed under `gpt-image-2.5-flare@pro` and `gpt-image-2.5-sunburst@pro`, the same IDs the task request sends, and priced by `quality`. The same snapshot observed `low` 0.0172, `medium` 0.0672, `high` 0.1829, `xhigh` 0.3572, `max` 0.7143, and `auto` 0.3572. These are dated snapshots, not billing guarantees; final billing follows the accepted task. Preflight does not create a task.

## Direct API recovery and optional features

```bash
curl -sS "https://api.hiapi.ai/v1/tasks/tk-hiapi-REPLACE_WITH_YOUR_TASK_ID" \
  -H "Authorization: Bearer $HIAPI_API_KEY"
```

Poll until the task is terminal. The public task detail may use `queued`, `handling`, `archiving`, `success`, or `fail`; retain unknown in-progress states as pollable. On a network timeout after submission, reuse the same idempotency key or recover with the task ID; do not create a second task.

The CLI does not expose callback or persistent-storage flags. When the account/API enables those optional features, the create request can carry the documented top-level controls:

```json
{
  "model": "gpt-image-2.5-flare/text-to-image",
  "input": { "prompt": "A quiet alpine lake at dawn" },
  "callback": { "url": "https://example.com/hiapi/callback", "when": "final" },
  "storage": "persistent"
}
```

See the [Unified Async API create-task reference](https://www.hiapi.ai/docs/async-api/create/). `callback` and `storage` are opt-in direct-API features; persistent storage may incur additional storage charges, so check the current pricing and account contract. Verify callback authenticity and the stored output before marking delivery complete. This CLI intentionally has no flags for them.
