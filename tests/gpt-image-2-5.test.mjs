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
  PRO_MODELS,
  MODE_MODELS,
} from "../scripts/lib/gpt-image-2-5.mjs";

test("estimate adds the row's own addons for reference images", async () => {
  // Shape mirrors the live /api/pricing rows for both @pro IDs.
  const referImagesAddon = {
    key: "reference-images",
    type: "array_length",
    path: "image_urls",
    unit_price: "0.007",
    unit_size: "1",
    missing: "zero",
  };
  const row = {
    model_name: "gpt-image-2.5-flare@pro",
    base_usd_value: 0.51,
    base_display_unit: { en: "per output image" },
    addons: [referImagesAddon],
    policies: [
      {
        name: "SQUARE, MEDIUM, 1K",
        rule: { framing: { match: "square" }, quality: { match: "medium" }, resolution: { match: "1K" } },
        usd_value: 0.0099,
      },
    ],
  };
  const pricing = { data: [row] };
  const fetchImpl = async () => ({ ok: true, status: 200, text: async () => JSON.stringify(pricing) });
  const edit = buildImagePayload({
    prompt: "p",
    model: PRO_MODELS.flare,
    imageUrls: ["https://example.com/a.png", "https://example.com/b.png"],
  });
  const estimate = await fetchPricingEstimate(edit, { fetchImpl });
  assert.equal(estimate.baseUsd, 0.0099);
  assert.equal(estimate.addonsUsd, 0.014);
  assert.equal(estimate.estimatedUsd, 0.0239);
  assert.equal(estimate.unitUsd, 0.0099);
  assert.deepEqual(estimate.addons, [
    {
      key: "reference-images",
      type: "array_length",
      path: "image_urls",
      quantity: 2,
      unitSize: 1,
      unitPriceUsd: 0.007,
      subtotalUsd: 0.014,
    },
  ]);
  // Without reference images the addon charges nothing.
  const textOnly = await fetchPricingEstimate(
    buildImagePayload({ prompt: "p", model: PRO_MODELS.flare }),
    { fetchImpl },
  );
  assert.equal(textOnly.addonsUsd, 0);
  assert.deepEqual(textOnly.addons, []);
  assert.equal(textOnly.estimatedUsd, 0.0099);
  // The unit price comes from the row, not from a hard-coded 0.007.
  const repriced = structuredClone(pricing);
  repriced.data[0].addons[0].unit_price = "0.02";
  const repricedEstimate = await fetchPricingEstimate(edit, {
    fetchImpl: async () => ({ ok: true, status: 200, text: async () => JSON.stringify(repriced) }),
  });
  assert.equal(repricedEstimate.addonsUsd, 0.04);
  assert.equal(repricedEstimate.estimatedUsd, 0.0499);
});
test("mode rows without addons keep their previous estimate shape", async () => {
  const pricing = {
    data: [
      {
        model_name: "gpt-image-2.5-flare/image-to-image",
        base_usd_value: 0.025,
        policies: [{ rule: { resolution: { match: "1K" } }, usd_value: 0.05 }],
      },
    ],
  };
  const fetchImpl = async () => ({ ok: true, status: 200, text: async () => JSON.stringify(pricing) });
  const estimate = await fetchPricingEstimate(
    buildImagePayload({ prompt: "p", imageUrls: ["https://x/a.png"] }),
    { fetchImpl },
  );
  assert.equal(estimate.estimatedUsd, 0.05);
  assert.equal(estimate.baseUsd, 0.05);
  assert.equal(estimate.addonsUsd, 0);
  assert.equal(estimate.pricingRule, undefined);
});
test("estimate matches the exact @pro pricing row by framing, resolution, and quality", async () => {
  const pricing = {
    data: [
      {
        model_name: "gpt-image-2.5-flare@pro",
        base_usd_value: 0.51,
        base_display_unit: { en: "per output image" },
        policies: [
          {
            name: "SQUARE, LOW, 1K",
            rule: { framing: { match: "square" }, quality: { match: "low" }, resolution: { match: "1K" } },
            usd_value: 0.0045,
          },
          {
            name: "SQUARE, MEDIUM, 1K",
            rule: { framing: { match: "square" }, quality: { match: "medium" }, resolution: { match: "1K" } },
            usd_value: 0.0099,
          },
          {
            name: "STANDARD, HIGH, 2K",
            rule: { framing: { match: "standard" }, quality: { match: "high" }, resolution: { match: "2K" } },
            usd_value: 0.043,
          },
          {
            name: "PANORAMA, LOW, 2K",
            rule: { framing: { match: "panorama" }, quality: { match: "low" }, resolution: { match: "2K" } },
            usd_value: 0.0032,
          },
        ],
      },
    ],
  };
  const fetchImpl = async () => ({ ok: true, status: 200, text: async () => JSON.stringify(pricing) });
  const low = buildImagePayload({ prompt: "p", model: PRO_MODELS.flare, quality: "low" });
  const lowEstimate = await fetchPricingEstimate(low, { fetchImpl });
  assert.equal(lowEstimate.model, "gpt-image-2.5-flare@pro");
  assert.equal(lowEstimate.pricingModel, "gpt-image-2.5-flare@pro");
  assert.equal(lowEstimate.unitUsd, 0.0045);
  assert.deepEqual(lowEstimate.pricingRule, { framing: "square", resolution: "1K", quality: "low" });

  const wide = buildImagePayload({
    prompt: "p",
    model: PRO_MODELS.flare,
    aspectRatio: "16:9",
    resolution: "2K",
    quality: "high",
  });
  assert.equal((await fetchPricingEstimate(wide, { fetchImpl })).unitUsd, 0.043);

  // A 3:1 pixel size at 4K bills as the 2K tier and panorama framing.
  const panorama = buildImagePayload({
    prompt: "p",
    model: PRO_MODELS.flare,
    aspectRatio: "3840x1280",
    resolution: "4K",
    quality: "low",
  });
  const panoramaEstimate = await fetchPricingEstimate(panorama, { fetchImpl });
  assert.deepEqual(panoramaEstimate.pricingRule, {
    framing: "panorama",
    resolution: "2K",
    quality: "low",
  });
  assert.equal(panoramaEstimate.unitUsd, 0.0032);

  await assert.rejects(
    fetchPricingEstimate(buildImagePayload({ prompt: "p", model: PRO_MODELS.sunburst }), { fetchImpl }),
    /does not list gpt-image-2.5-sunburst/,
  );
});
test("builds exact t2i and i2i payloads and omits empty image_urls", () => {
  const t = buildImagePayload({
    model: PRO_MODELS.flare,
    prompt: "poster",
    aspectRatio: "3840x2160",
    resolution: "4K",
    quality: "xhigh",
  });
  assert.deepEqual(t, {
    model: PRO_MODELS.flare,
    input: {
      prompt: "poster",
      aspect_ratio: "3840x2160",
      quality: "xhigh",
      background: "auto",
      output_format: "webp",
      resolution: "4K",
    },
  });
  assert.equal(t.input.framing, undefined);
  const i = buildImagePayload({
    model: PRO_MODELS.sunburst,
    prompt: "edit",
    imageUrls: ["https://example.com/a.png"],
    background: "transparent",
    outputFormat: "png",
  });
  assert.equal(i.model, PRO_MODELS.sunburst);
  assert.deepEqual(i.input.image_urls, ["https://example.com/a.png"]);
  assert.equal(i.input.resolution, "1K");
});
test("enforces schema enums, image count, and transparent format", () => {
  assert.throws(
    () => buildImagePayload({ prompt: "x", model: PRO_MODELS.flare, aspectRatio: "7:5" }),
    /Unsupported aspect ratio/,
  );
  assert.throws(
    () => buildImagePayload({ prompt: "x", model: PRO_MODELS.flare, aspectRatio: "auto" }),
    /no auto size/,
  );
  assert.throws(
    () =>
      buildImagePayload({
        prompt: "x",
        model: PRO_MODELS.flare,
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
      PRO_MODELS.sunburst,
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
  assert.throws(() => buildImagePayload({ prompt: "p", model: PRO_MODELS.flare, quality: "auto" }), /Unsupported quality "auto"/);
  assert.throws(
    () => buildImagePayload({ prompt: "p", model: PRO_MODELS.flare, framing: "square" }),
    /must not be sent/,
  );
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
test("@pro accepts the 15 ratios and WxH pixel sizes, rejects auto and framing", () => {
  for (const ratio of [
    "1:1", "3:2", "2:3", "4:3", "3:4", "5:4", "4:5", "16:9", "9:16",
    "2:1", "1:2", "21:9", "9:21", "3:1", "1:3",
  ]) {
    assert.equal(
      buildImagePayload({ prompt: "p", route: "pro", aspectRatio: ratio }).input.aspect_ratio,
      ratio,
    );
  }
  for (const pixels of ["1024x1024", "1536x1024", "1152x1536", "3840x2160", "704x1536"])
    assert.equal(
      buildImagePayload({ prompt: "p", route: "pro", aspectRatio: pixels }).input.aspect_ratio,
      pixels,
    );
  assert.throws(
    () => buildImagePayload({ prompt: "p", route: "pro", aspectRatio: "auto" }),
    /no auto size/,
  );
  assert.throws(
    () => buildImagePayload({ prompt: "p", route: "pro", aspectRatio: "7x8" }),
    /Unsupported aspect ratio/,
  );
  // The schema side pattern is 2–4 digits, so a shape-valid but too-small
  // 10x1024 reports the arithmetic limit instead.
  assert.throws(
    () => buildImagePayload({ prompt: "p", route: "pro", aspectRatio: "10x1024" }),
    /at least 16/,
  );
  assert.throws(
    () => buildImagePayload({ prompt: "p", route: "pro", aspectRatio: "1536X1024" }),
    /Unsupported aspect ratio/,
  );
  assert.throws(
    () => buildImagePayload({ prompt: "p", route: "pro", aspectRatio: "3841x1024" }),
    /must not exceed 3840/,
  );
  for (const framing of ["square", "standard", "panorama"])
    assert.throws(
      () => buildImagePayload({ prompt: "p", route: "pro", framing }),
      /must not be sent/,
    );
  assert.throws(() => buildImagePayload({ prompt: "p", framing: "square" }), /must not be sent/);
  const parsed = parseArgs(["--route", "pro", "--framing", "square", "p"]);
  assert.equal(parsed.framing, "square");
});
test("@pro accepts all five qualities and defaults to medium with resolution 1K", () => {
  for (const quality of ["low", "medium", "high", "xhigh", "max"])
    assert.equal(
      buildImagePayload({ prompt: "p", route: "pro", quality }).input.quality,
      quality,
    );
  const defaults = buildImagePayload({ prompt: "p", route: "pro" });
  assert.equal(defaults.input.quality, "medium");
  assert.equal(defaults.input.resolution, "1K");
  assert.equal(defaults.input.aspect_ratio, "1:1");
  assert.throws(
    () => buildImagePayload({ prompt: "p", route: "pro", quality: "auto" }),
    /Unsupported quality "auto"/,
  );
  assert.throws(
    () => buildImagePayload({ prompt: "p", route: "pro", resolution: "8K" }),
    /Unsupported resolution/,
  );
});
test("@pro framing follows the backend long-side ratio thresholds", async () => {
  const { computeFraming, proPricingInput } = await import("../scripts/lib/gpt-image-2-5.mjs");
  assert.equal(computeFraming("1:1"), "square");
  assert.equal(computeFraming("5:4"), "square");
  assert.equal(computeFraming("4:3"), "standard");
  assert.equal(computeFraming("2:1"), "standard");
  assert.equal(computeFraming("21:9"), "panorama");
  assert.equal(computeFraming("3:1"), "panorama");
  assert.equal(computeFraming("1:3"), "panorama");
  assert.equal(computeFraming("1152x1536"), "standard");
  assert.equal(computeFraming("1024x1024"), "square");
  // Ratio at 4K whose long side is capped at 3840 bills as the 2K tier.
  assert.equal(proPricingInput({ aspect_ratio: "3:1", resolution: "4K" }).resolution, "2K");
  assert.equal(proPricingInput({ aspect_ratio: "21:9", resolution: "4K" }).resolution, "4K");
  assert.equal(proPricingInput({ aspect_ratio: "16:9", resolution: "4K" }).resolution, "4K");
  // WxH bills by total pixels regardless of the declared resolution.
  assert.equal(proPricingInput({ aspect_ratio: "1024x1024", resolution: "4K" }).resolution, "1K");
  assert.equal(proPricingInput({ aspect_ratio: "2048x2048", resolution: "1K" }).resolution, "2K");
  assert.equal(proPricingInput({ aspect_ratio: "3840x2160", resolution: "1K" }).resolution, "4K");
});
test("bare family IDs are rejected; --route pro selects the @pro model", () => {
  for (const bare of ["gpt-image-2.5-flare", "gpt-image-2.5-sunburst"])
    assert.throws(() => buildImagePayload({ prompt: "p", model: bare }), /cannot be requested directly/);
  const pro = buildImagePayload({ prompt: "p", route: "pro", family: "sunburst", quality: "low" });
  assert.equal(pro.model, PRO_MODELS.sunburst);
  assert.equal(pro.input.quality, "low");
  assert.equal(
    buildImagePayload({ prompt: "p", route: "pro", imageUrls: ["https://x/a.png"] }).model,
    PRO_MODELS.flare,
  );
  assert.equal(buildImagePayload({ prompt: "p", route: "mode" }).model, MODE_MODELS.flareTextToImage);
  assert.throws(() => buildImagePayload({ prompt: "p", route: "pro", model: MODE_MODELS.flareTextToImage }), /conflicts/);
  assert.throws(() => buildImagePayload({ prompt: "p", route: "mode", model: PRO_MODELS.flare }), /conflicts/);
  assert.throws(() => buildImagePayload({ prompt: "p", route: "fast" }), /Unsupported route/);
  assert.equal(parseArgs(["--route", "pro", "p"]).route, "pro");
});
