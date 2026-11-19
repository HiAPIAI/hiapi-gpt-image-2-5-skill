import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import {
  ALL_MODEL_IDS,
  ASPECT_RATIOS,
  DEFAULT_SITE_URL,
  QUALITIES,
  buildImagePayload,
  checkLiveContract,
  fetchPricingEstimate,
  generateImage,
} from "../scripts/lib/gpt-image-2-5.mjs";

// Public no-key schemas captured from
// https://api.hiapi.ai/api/models/content?name=<model ID>.
// The four mode schemas were captured on 2026-10-05; the two `@pro` schemas
// were re-captured on 2026-11-19, when production switched `@pro` to
// pattern-based sizes plus `resolution` and a server-computed `framing`.
const schemas = JSON.parse(await readFile(
  new URL("./fixtures/gpt-image-2-5-schemas.json", import.meta.url), "utf8",
));
const routeInputs = ALL_MODEL_IDS.flatMap((model) => {
  const input = { model };
  if (model.endsWith("/image-to-image"))
    input.imageUrls = ["https://example.com/reference.png"];
  return model.endsWith("@pro")
    ? [input, { ...input, imageUrls: ["https://example.com/reference.png"] }]
    : [input];
});

for (const options of routeInputs) {
  const label = `${options.model} (${options.imageUrls ? "editing" : "generation"})`;
  test(`${label} accepts 20000 and rejects 20001`, () => {
    for (const character of ["x", "画"]) {
      const prompt = character.repeat(20000);
      assert.equal(buildImagePayload({ ...options, prompt }).input.prompt, prompt);
      assert.throws(
        () => buildImagePayload({ ...options, prompt: prompt + character }),
        /prompt must be at most 20000 characters\./,
      );
    }
  });

  test(`${label} retains trimmed UTF-16 counting and rejects blank prompts`, () => {
    const prompt = "😀".repeat(10000);
    assert.equal(prompt.length, 20000);
    assert.equal(buildImagePayload({ ...options, prompt: ` \n${prompt}\t ` }).input.prompt, prompt);
    assert.throws(() => buildImagePayload({ ...options, prompt: prompt + "x" }), /at most 20000/);
    assert.throws(() => buildImagePayload({ ...options, prompt: " \n\t " }), /non-empty prompt/);
  });
}

test("over-limit prompts never create a task on any route", async () => {
  let posts = 0;
  const fetchImpl = async (_url, options = {}) => {
    if (options.method === "POST") posts += 1;
    return new Response(JSON.stringify({
      id: "hiapi-gpt-image-2-5",
      updatePolicy: { latestVersion: "0.1.0", minimumVersion: "0.1.0" },
    }));
  };
  for (const options of routeInputs) {
    await assert.rejects(generateImage(
      { ...options, prompt: "x".repeat(20001), wait: false, fetchImpl },
      { apiKey: "test-key", baseUrl: "https://mock.local" },
    ), /at most 20000/);
  }
  assert.equal(posts, 0);
});

function schemaFetch(snapshot) {
  return async (rawUrl, options) => {
    const url = new URL(rawUrl);
    assert.equal(url.pathname, "/api/models/content");
    assert.equal(options.method ?? "GET", "GET");
    assert.equal(options.headers.Authorization, undefined);
    const schema = snapshot[url.searchParams.get("name")];
    assert.ok(schema, "each request must select an exact supported model ID");
    return new Response(JSON.stringify({ data: { input_schema: schema } }));
  };
}

test("all six captured schemas pass and report the actual prompt limit", async () => {
  const result = await checkLiveContract({ fetchImpl: schemaFetch(schemas) });
  assert.equal(result.ok, true);
  assert.deepEqual(result.checks.map((c) => c.model).sort(), [...ALL_MODEL_IDS].sort());
  for (const check of result.checks) {
    assert.equal(check.ok, true);
    assert.equal(check.promptMinLength, 1);
    assert.equal(check.promptMaxLength, 20000);
    assert.equal(check.expectedPromptMaxLength, 20000);
  }
});

for (const model of ALL_MODEL_IDS) {
  test(`${model} rejects stale, missing, and off-by-one schema prompt limits`, async () => {
    for (const maxLength of [19999, 20001, 10000, 40000, undefined]) {
      const snapshot = structuredClone(schemas);
      snapshot[model].properties.prompt.maxLength = maxLength;
      const result = await checkLiveContract({ fetchImpl: schemaFetch(snapshot) });
      assert.equal(result.ok, false);
      assert.deepEqual(result.checks.filter((c) => !c.ok).map((c) => c.model), [model]);
      assert.equal(result.checks.find((c) => c.model === model).promptMaxLength, maxLength);
    }
  });
}

test("20000 prompt limits do not hide other contract violations", async () => {
  for (const model of ALL_MODEL_IDS) {
    const isPro = model.endsWith("@pro");
    for (const mutate of [
      (schema) => { schema.required = []; },
      (schema) => { schema.properties.aspect_ratio.default = "unsupported"; },
      // @pro sizes are a pattern, not an enum: break the pattern instead.
      ...(isPro
        ? [
            (schema) => { schema.properties.aspect_ratio.pattern = "^(auto)$"; },
            (schema) => { schema.properties.aspect_ratio.enum = [...ASPECT_RATIOS]; },
            (schema) => { schema.properties.quality.enum = [...QUALITIES, "auto"]; },
            (schema) => { schema.properties.quality.default = "high"; },
            (schema) => { schema.properties.resolution.default = "2K"; },
            (schema) => { delete schema.properties.resolution; },
            (schema) => { delete schema.properties.framing; },
            (schema) => { schema.properties.framing.visible = true; },
            (schema) => { schema.properties.framing["x-hiapi-server-computed"] = false; },
          ]
        : [
            (schema) => { schema.properties.aspect_ratio.enum = ["unsupported"]; },
          ]),
      (schema) => { schema.properties.prompt.minLength = 0; },
      (schema) => { schema.properties.model.enum = ["unsupported"]; },
      ...(schemas[model].properties.image_urls ? [
        (schema) => { schema.properties.image_urls.maxItems = 17; },
      ] : []),
    ]) {
      const snapshot = structuredClone(schemas);
      mutate(snapshot[model]);
      const result = await checkLiveContract({ fetchImpl: schemaFetch(snapshot) });
      assert.equal(result.ok, false, `${model} mutation ${mutate}`);
      assert.deepEqual(result.checks.filter((c) => !c.ok).map((c) => c.model), [model]);
    }
  }
});

test("default public endpoints resolve to the api host, not the www site", async () => {
  assert.equal(DEFAULT_SITE_URL, "https://api.hiapi.ai");
  const requested = [];
  const fetchImpl = async (rawUrl) => {
    requested.push(String(rawUrl));
    return new Response(JSON.stringify({ data: { input_schema: schemas[ALL_MODEL_IDS[0]] } }));
  };
  const saved = process.env.HIAPI_SITE_URL;
  delete process.env.HIAPI_SITE_URL;
  try {
    await checkLiveContract({ fetchImpl }).catch(() => {});
    await fetchPricingEstimate(buildImagePayload({ prompt: "p" }), { fetchImpl }).catch(() => {});
  } finally {
    if (saved !== undefined) process.env.HIAPI_SITE_URL = saved;
  }
  assert.ok(requested.length > 0, "requests were issued");
  assert.ok(
    requested.every((url) => url.startsWith("https://api.hiapi.ai/api/")),
    requested.join(", "),
  );
});
