# API contract

The authoritative model pages are [Flare](https://www.hiapi.ai/docs/models/image/gpt-image-2-5-flare/) and [Sunburst](https://www.hiapi.ai/docs/models/image/gpt-image-2-5-sunburst/). Both currently document the same request schema. This local skill sends `POST https://api.hiapi.ai/v1/tasks` with `Authorization: Bearer $HIAPI_API_KEY`, `Content-Type: application/json`, and an `Idempotency-Key` no longer than 255 UTF-8 bytes.

```json
{
  "model": "gpt-image-2.5-flare",
  "input": {
    "prompt": "A quiet alpine lake at dawn",
    "aspect_ratio": "1:1",
    "quality": "medium",
    "background": "auto",
    "output_format": "webp"
  }
}
```

`model` is required and must be exactly `gpt-image-2.5-flare` or `gpt-image-2.5-sunburst`. `input.prompt` is required, a string of 1–32,000 characters. Omit `input.image_urls` for text-to-image. For editing or visual references, provide 1–16 non-empty public `http://` or `https://` URLs without embedded credentials; an empty array is invalid. Explain the role and order of multiple references in the prompt.

| Field | Type | Default | Accepted values / constraint |
| --- | --- | --- | --- |
| `input.aspect_ratio` | enum | `1:1` | `1:1`, `3:2`, `2:3`, `4:3`, `3:4`, `16:9`, `9:16`, `auto`, `1024x1024`, `1536x1024`, `1024x1536`, `1536x1152`, `1152x1536`, `2048x2048`, `2048x1152`, `1152x2048`, `3840x2160`, `2160x3840` |
| `input.quality` | enum | `medium` | `low`, `medium`, `high`, `xhigh`, `max`, `auto` |
| `input.background` | enum | `auto` | `auto`, `transparent`, `opaque` |
| `input.output_format` | enum | `webp` | `png`, `jpeg`, `webp`; transparency requires `png` or `webp` |

The CLI flag mapping is `--model`, repeated `--image-url`, `--aspect-ratio`, `--quality`, `--background`, and `--output-format`. There is no CLI `n` or batch count: one task means one image.

## Pricing and estimates

`--estimate` reads `https://www.hiapi.ai/api/pricing` and matches the selected model and input policy. A 2026-09-09 snapshot observed the following USD/image values: `low` 0.0172, `medium` 0.0672, `high` 0.1829, `xhigh` 0.3572, `max` 0.7143, and `auto` 0.3572. These are a dated snapshot, not a billing guarantee; final billing follows the accepted task. Preflight does not create a task.

## Direct API recovery and optional features

```bash
curl -sS "https://api.hiapi.ai/v1/tasks/tk-hiapi-REPLACE_WITH_YOUR_TASK_ID" \
  -H "Authorization: Bearer $HIAPI_API_KEY"
```

Poll until the task is terminal. The public task detail may use `queued`, `handling`, `archiving`, `success`, or `fail`; retain unknown in-progress states as pollable. On a network timeout after submission, reuse the same idempotency key or recover with the task ID; do not create a second task.

The CLI does not expose callback or persistent-storage flags. When the account/API enables those optional features, the create request can carry the documented top-level controls:

```json
{
  "model": "gpt-image-2.5-flare",
  "input": { "prompt": "A quiet alpine lake at dawn" },
  "callback": { "url": "https://example.com/hiapi/callback", "when": "final" },
  "storage": "persistent"
}
```

See the [Unified Async API create-task reference](https://www.hiapi.ai/docs/async-api/create/). `callback` and `storage` are opt-in direct-API features; persistent storage may incur additional storage charges, so check the current pricing and account contract. Verify callback authenticity and the stored output before marking delivery complete. This CLI intentionally has no flags for them.
