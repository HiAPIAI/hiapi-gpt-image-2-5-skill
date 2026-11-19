# API contract

This skill sends `POST https://api.hiapi.ai/v1/tasks` with `Authorization: Bearer $HIAPI_API_KEY`, `Content-Type: application/json`, and an `Idempotency-Key` no longer than 255 UTF-8 bytes. `model` is top level; parameters sit inside `input`.

All six model IDs have a public `input.prompt` schema of `minLength: 1`, `maxLength: 20000` (raised on 2026-10-13; verified 2026-10-23). The CLI retains its existing counting semantics: trim surrounding whitespace, then validate JavaScript `string.length` (UTF-16 code units). BMP characters count as one unit; astral characters such as `😀` count as two. Empty or over-limit prompts are rejected before task creation; a request that still exceeds the limit reaches the API as `INVALID_REQUEST` with a `maxLength` message.

Text-to-image has an additional internal o200k token cap. A prompt under 20,000 characters can still exceed it (for example, dense CJK text), and the task returns `PROMPT_TOO_LONG`. Image-to-image does not have this token cap. Neither limit is billing-related; both fail before an image is produced.

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

Authoritative pages: [Flare text-to-image](https://www.hiapi.ai/docs/models/image/gpt-image-2-5-flare-text-to-image/?utm_source=github&utm_medium=readme&utm_campaign=hiapi-gpt-image-2-5), [Flare image-to-image](https://www.hiapi.ai/docs/models/image/gpt-image-2-5-flare-image-to-image/?utm_source=github&utm_medium=readme&utm_campaign=hiapi-gpt-image-2-5), [Sunburst text-to-image](https://www.hiapi.ai/docs/models/image/gpt-image-2-5-sunburst-text-to-image/?utm_source=github&utm_medium=readme&utm_campaign=hiapi-gpt-image-2-5), [Sunburst image-to-image](https://www.hiapi.ai/docs/models/image/gpt-image-2-5-sunburst-image-to-image/?utm_source=github&utm_medium=readme&utm_campaign=hiapi-gpt-image-2-5). All four share one schema; image-to-image additionally requires `image_urls`.

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
| `input.prompt` | string | — (required) | 1–20,000 characters |
| `input.image_urls` | string[] | — | image-to-image only, required there: 1–16 JPEG/PNG/WebP, each ≤ 20 MP and ≤ 30 MB, public directly-downloadable HTTP(S) URL or data URI; forbidden for text-to-image |
| `input.aspect_ratio` | enum | `auto` | `auto`, `1:1`, `3:2`, `2:3`, `4:3`, `3:4`, `16:9`, `9:16`, `21:9`, `27:16`, `16:27`, `9:8`, `8:9` |
| `input.resolution` | enum | `1K` | `1K`, `2K`, `4K` |
| `input.background` | enum | none (omitted) | `transparent`, `opaque`, `auto`; allowed only when `resolution` is `1K`. Transparent returns a PNG with alpha — describe an isolated subject with no backdrop or shadow |

There is no `quality`, `output_format`, or `n` on this route. CLI flags: `--family`, `--model`, repeated `--image-url`, `--aspect-ratio`, `--resolution`, `--background`.

## Pro route (`@pro`, quality × framing × resolution)

Selected with `--route pro` (plus `--family sunburst` when requested) or `--model gpt-image-2.5-flare@pro` / `--model gpt-image-2.5-sunburst@pro`. The live public schema for each `@pro` ID is checked by `npm run check:contract`; see the [pricing page](https://www.hiapi.ai/en/pricing?utm_source=github&utm_medium=readme&utm_campaign=hiapi-gpt-image-2-5) for current prices.

```json
{
  "model": "gpt-image-2.5-flare@pro",
  "input": {
    "prompt": "A quiet alpine lake at dawn",
    "aspect_ratio": "16:9",
    "resolution": "2K",
    "quality": "high",
    "background": "auto",
    "output_format": "webp"
  }
}
```

`input.prompt` is required, 1–20,000 characters. Omit `input.image_urls` for text-to-image; for editing provide 1–16 non-empty public `http://` or `https://` URLs without embedded credentials. Explain the role and order of multiple references in the prompt.

| Field | Type | Default | Accepted values / constraint |
| --- | --- | --- | --- |
| `input.aspect_ratio` | string (pattern) | `1:1` | One of 15 ratios — `1:1`, `3:2`, `2:3`, `4:3`, `3:4`, `5:4`, `4:5`, `16:9`, `9:16`, `2:1`, `1:2`, `21:9`, `9:21`, `3:1`, `1:3` — or an exact `WxH` pixel size (both sides multiples of 16, each side 16–3840, total pixels 655,360–8,294,400, long side at most 3× the short side). `auto` is not accepted |
| `input.resolution` | enum | `1K` | `1K`, `2K`, `4K`. Defines the output budget for a ratio; with `WxH` the tier follows total pixels instead |
| `input.quality` | enum | `medium` | `low`, `medium`, `high`, `xhigh`, `max`. `auto` is not accepted |
| `input.background` | enum | `auto` | `auto`, `transparent`, `opaque`; independent of resolution. Transparency requires `png` or `webp` output |
| `input.output_format` | enum | `webp` | `png`, `jpeg`, `webp` |

`input.framing` (`square` / `standard` / `panorama`, default `standard`) is declared in the public schema only so price rules can reference it. It is server-computed from `aspect_ratio` — long side ÷ short side below 1.3 is `square`, 1.3–2 is `standard`, above 2 is `panorama` — and the schema marks it `visible: false` and `x-hiapi-server-computed: true`. Sending it returns HTTP 400, and the CLI rejects `--framing` locally.

CLI flags: `--route pro`, `--family`, `--model`, repeated `--image-url`, `--aspect-ratio`, `--resolution`, `--quality`, `--background`, `--output-format`.

## Pricing and estimates

`--estimate` reads `https://api.hiapi.ai/api/pricing` and matches the selected model and input policy. Mode models are listed under their exact IDs and priced by `resolution`; a 2026-09-29 snapshot observed USD/image `1K` 0.05, `2K` 0.08, `4K` 0.12 for all four. The `@pro` models are listed under `gpt-image-2.5-flare@pro` and `gpt-image-2.5-sunburst@pro`, the same IDs the task request sends, and priced by fixed rules over `{framing, quality, resolution}` — 45 cells per model (3 framings × 5 qualities × 3 tiers). The CLI derives `framing` and the billed resolution tier locally before matching, because `framing` is server-computed and a ratio's billed tier follows its actual output pixels (a 3:1 or 1:3 size at `--resolution 4K` outputs 3840×1280 and is billed as `2K`). A 2026-11-19 snapshot observed, for both `@pro` IDs, USD/image:

| framing | quality | 1K | 2K | 4K |
| --- | --- | --- | --- | --- |
| square | low / medium / high / xhigh / max | 0.0045 / 0.0099 / 0.039 / 0.07 / 0.16 | 0.0094 / 0.021 / 0.083 / 0.15 / 0.33 | 0.014 / 0.032 / 0.13 / 0.23 / 0.51 |
| standard | low / medium / high / xhigh / max | 0.0034 / 0.0074 / 0.029 / 0.052 / 0.12 | 0.0049 / 0.011 / 0.043 / 0.075 / 0.17 | 0.0098 / 0.022 / 0.086 / 0.15 / 0.35 |
| panorama | low / medium / high / xhigh / max | 0.0021 / 0.0044 / 0.018 / 0.031 / 0.07 | 0.0032 / 0.0072 / 0.029 / 0.05 / 0.11 | 0.0057 / 0.012 / 0.05 / 0.086 / 0.2 |

Both `@pro` rows also carry a per-reference-image add-on of USD 0.007 per `image_urls` entry; the estimate reports the base output-image price only. These are dated snapshots, not billing guarantees; final billing follows the accepted task. Preflight does not create a task.

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

See the [Unified Async API create-task reference](https://www.hiapi.ai/docs/async-api/create/?utm_source=github&utm_medium=readme&utm_campaign=hiapi-gpt-image-2-5). `callback` and `storage` are opt-in direct-API features; persistent storage may incur additional storage charges, so check the current pricing and account contract. Verify callback authenticity and the stored output before marking delivery complete. This CLI intentionally has no flags for them.
