import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildImagePayload,
  createImageTask,
  extractImageUrl,
  normalizeImageUrls,
  parseArgs,
  waitForImage,
  fetchPricingEstimate,
  MODELS,
  MODE_MODELS,
} from "../scripts/lib/gpt-image-2-5.mjs";

test("estimate matches the canonical @pro pricing row for a bare model ID", async () => {
  const pricing = {
    data: [
      {
        model_name: "gpt-image-2.5-flare@pro",
        base_usd_value: 0.0672,
        base_display_unit: { en: "per output image" },
        policies: [
          { name: "LOW", rule: { quality: { match: "low" } }, usd_value: 0.0172 },
          { name: "MEDIUM", rule: { quality: { match: "medium" } }, usd_value: 0.0672 },
        ],
      },
    ],
  };
  const fetchImpl = async () => ({ ok: true, status: 200, text: async () => JSON.stringify(pricing) });
  const payload = buildImagePayload({ prompt: "p", model: MODELS.flare, quality: "low" });
  const estimate = await fetchPricingEstimate(payload, { fetchImpl });
  assert.equal(estimate.model, "gpt-image-2.5-flare");
  assert.equal(estimate.pricingModel, "gpt-image-2.5-flare@pro");
  assert.equal(estimate.unitUsd, 0.0172);
  await assert.rejects(
    fetchPricingEstimate(buildImagePayload({ prompt: "p", model: MODELS.sunburst }), { fetchImpl }),
    /does not list gpt-image-2.5-sunburst/,
  );
});
test("builds exact t2i and i2i payloads and omits empty image_urls", () => {
  const t = buildImagePayload({
    model: MODELS.flare,
    prompt: "poster",
    aspectRatio: "3840x2160",
    quality: "xhigh",
  });
  assert.deepEqual(t, {
    model: MODELS.flare,
    input: {
      prompt: "poster",
      aspect_ratio: "3840x2160",
      quality: "xhigh",
      background: "auto",
      output_format: "webp",
    },
  });
  const i = buildImagePayload({
    model: MODELS.sunburst,
    prompt: "edit",
    imageUrls: ["https://example.com/a.png"],
    background: "transparent",
    outputFormat: "png",
  });
  assert.equal(i.model, MODELS.sunburst);
  assert.deepEqual(i.input.image_urls, ["https://example.com/a.png"]);
});
test("enforces schema enums, image count, and transparent format", () => {
  assert.throws(
    () => buildImagePayload({ prompt: "x", model: MODELS.flare, aspectRatio: "2:1" }),
    /Unsupported aspect ratio/,
  );
  assert.throws(
    () =>
      buildImagePayload({
        prompt: "x",
        model: MODELS.flare,
        background: "transparent",
        outputFormat: "jpeg",
      }),
    /transparent background/,
  );
  assert.throws(
    () =>
      normalizeImageUrls(
        Array.from({ length: 17 }, (_, i) => `https://x/${i}.png`),
      ),
    /At most 16/,
  );
  assert.throws(() => normalizeImageUrls(["asset://x"]), /HTTP\(S\)/);
});
test("uses idempotency and immediate task handle", async () => {
  let posted;
  const fetchImpl = async (_u, o) => {
    posted = o;
    return new Response(
      JSON.stringify({ code: 200, data: { taskId: "task-1" } }),
      { status: 200 },
    );
  };
  const r = await createImageTask(
    buildImagePayload({ prompt: "x" }),
    { apiKey: "k", baseUrl: "https://api.example" },
    { idempotencyKey: "idem-1", fetchImpl },
  );
  assert.equal(r.taskId, "task-1");
  assert.equal(posted.headers["Idempotency-Key"], "idem-1");
});
test("polls queued and handling then extracts image output", async () => {
  let n = 0;
  const fetchImpl = async () =>
    new Response(
      JSON.stringify(
        n++ < 2
          ? { data: { status: n === 1 ? "queued" : "handling" } }
          : {
              data: {
                status: "success",
                output: [{ type: "image", url: "https://cdn/x.webp" }],
              },
            },
      ),
      { status: 200 },
    );
  const r = await waitForImage(
    "t",
    { apiKey: "k", baseUrl: "https://api" },
    { fetchImpl, pollIntervalMs: 0, timeoutMinutes: 1 },
  );
  assert.equal(r.imageUrl, "https://cdn/x.webp");
});
test("parses CLI preflight and output URL shapes", () => {
  assert.deepEqual(
    parseArgs([
      "--model",
      MODELS.sunburst,
      "--prompt",
      "x",
      "--image-url",
      "https://x/a.png",
      "--dry-run",
    ]).imageUrls,
    ["https://x/a.png"],
  );
  assert.equal(
    extractImageUrl({
      data: { output: [{ type: "image", url: "https://x/i.png" }] },
    }),
    "https://x/i.png",
  );
});

test("defaults to the family mode route chosen by reference images", () => {
  assert.deepEqual(buildImagePayload({ prompt: "p" }), {
    model: MODE_MODELS.flareTextToImage,
    input: { prompt: "p", aspect_ratio: "auto", resolution: "1K" },
  });
  const edit = buildImagePayload({
    prompt: "e",
    family: "sunburst",
    imageUrls: ["https://example.com/a.png", "data:image/png;base64,AAAA"],
    resolution: "4k",
    aspectRatio: "21:9",
  });
  assert.equal(edit.model, MODE_MODELS.sunburstImageToImage);
  assert.equal(edit.input.resolution, "4K");
  assert.equal(edit.input.aspect_ratio, "21:9");
  assert.equal(edit.input.background, undefined);
  assert.equal(
    buildImagePayload({ prompt: "p", background: "transparent" }).input.background,
    "transparent",
  );
});
test("mode route rejects quality-tier fields and cross-field violations", () => {
  assert.throws(() => buildImagePayload({ prompt: "p", quality: "high" }), /priced by resolution/);
  assert.throws(() => buildImagePayload({ prompt: "p", outputFormat: "png" }), /priced by resolution/);
  assert.throws(
    () => buildImagePayload({ prompt: "p", resolution: "2K", background: "opaque" }),
    /only at resolution 1K/,
  );
  assert.throws(() => buildImagePayload({ prompt: "p", aspectRatio: "1536x1024" }), /Unsupported aspect ratio/);
  assert.throws(() => buildImagePayload({ prompt: "x".repeat(20001) }), /at most 20000/);
  assert.throws(() => buildImagePayload({ prompt: "p", model: MODELS.flare, resolution: "1K" }), /priced by quality/);
  assert.throws(
    () => buildImagePayload({ prompt: "p", model: MODE_MODELS.flareImageToImage }),
    /requires 1–16 image_urls/,
  );
  assert.throws(
    () => buildImagePayload({ prompt: "p", model: MODE_MODELS.flareTextToImage, imageUrls: ["https://x/a.png"] }),
    /does not accept image_urls/,
  );
  assert.throws(
    () => buildImagePayload({ prompt: "p", family: "flare", model: MODE_MODELS.sunburstTextToImage }),
    /conflicts/,
  );
  assert.throws(() => buildImagePayload({ prompt: "p", family: "nova" }), /Unsupported family/);
});
test("estimate matches the exact mode pricing row by resolution", async () => {
  const pricing = {
    data: [
      {
        model_name: "gpt-image-2.5-flare/image-to-image",
        base_usd_value: 0.05,
        policies: [
          { rule: { resolution: { match: "1K" } }, usd_value: 0.05 },
          { rule: { resolution: { match: "2K" } }, usd_value: 0.08 },
        ],
      },
    ],
  };
  const fetchImpl = async () => ({ ok: true, status: 200, text: async () => JSON.stringify(pricing) });
  const payload = buildImagePayload({ prompt: "p", imageUrls: ["https://x/a.png"], resolution: "2K" });
  const estimate = await fetchPricingEstimate(payload, { fetchImpl });
  assert.equal(estimate.pricingModel, "gpt-image-2.5-flare/image-to-image");
  assert.equal(estimate.unitUsd, 0.08);
});
test("parses family and resolution flags", () => {
  const o = parseArgs(["--family", "sunburst", "--resolution", "2K", "p"]);
  assert.equal(o.family, "sunburst");
  assert.equal(o.resolution, "2K");
  assert.equal(o.prompt, "p");
});
