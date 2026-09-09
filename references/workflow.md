# Brief-to-delivery workflow

1. Define the outcome, audience, dimensions, and retention need. Confirm rights and consent for every reference image.
2. Choose text-to-image or editing. Omit `image_urls` for text-to-image; use 1–16 accessible URLs for editing and describe each URL's role in order. Choose Flare by default, or select Sunburst only when explicitly requested.
3. Freeze the prompt and schema options. Run `--dry-run --estimate`; review the redacted payload and dated estimate.
4. Submit exactly once with a stable idempotency key. Capture the key and task ID immediately. An HTTP/network ambiguity is an acceptance-unknown state: reuse the key or task ID.
5. Wait, or use `--no-wait` and resume later. Poll transient states. A timeout is recoverable; it is not permission to create a duplicate.
6. Complete delivery: download the successful output, validate signature/content type, dimensions, format, and alpha. A URL-only `--no-save` result is a deliberate handoff and is not retained delivery until the caller downloads it.
7. Complete creative QC: check subject, edit boundaries, composition, readable text, unwanted artifacts, safety/policy, and source rights. Record acceptance or the exact defect, then edit/retry through a new authorized task only when needed.
8. Retain the file and internal task evidence. Publish only after technical and creative acceptance. Customer-facing material should contain the usable artifact and public model facts, not keys, task IDs, costs, or private URLs.
