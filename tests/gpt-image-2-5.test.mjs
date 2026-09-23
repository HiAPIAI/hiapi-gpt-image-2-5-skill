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
  const payload = buildImagePayload({ prompt: "p", quality: "low" });
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
    () => buildImagePayload({ prompt: "x", aspectRatio: "2:1" }),
    /Unsupported aspect ratio/,
  );
  assert.throws(
    () =>
      buildImagePayload({
        prompt: "x",
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
