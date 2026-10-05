import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import {
  ALL_MODEL_IDS,
  buildImagePayload,
  checkLiveContract,
  generateImage,
} from "../scripts/lib/gpt-image-2-5.mjs";

// Public no-key schemas captured 2026-10-05 from
// https://www.hiapi.ai/api/models/content?name=<model ID>.
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
  test(`${label} accepts 8000 and rejects 8001`, () => {
    for (const character of ["x", "画"]) {
      const prompt = character.repeat(8000);
      assert.equal(buildImagePayload({ ...options, prompt }).input.prompt, prompt);
      assert.throws(
        () => buildImagePayload({ ...options, prompt: prompt + character }),
        /prompt must be at most 8000 characters\./,
      );
    }
  });

  test(`${label} retains trimmed UTF-16 counting and rejects blank prompts`, () => {
    const prompt = "😀".repeat(4000);
    assert.equal(prompt.length, 8000);
    assert.equal(buildImagePayload({ ...options, prompt: ` \n${prompt}\t ` }).input.prompt, prompt);
    assert.throws(() => buildImagePayload({ ...options, prompt: prompt + "x" }), /at most 8000/);
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
      { ...options, prompt: "x".repeat(8001), wait: false, fetchImpl },
      { apiKey: "test-key", baseUrl: "https://mock.local" },
    ), /at most 8000/);
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
    assert.equal(check.promptMaxLength, 8000);
    assert.equal(check.expectedPromptMaxLength, 8000);
  }
});

for (const model of ALL_MODEL_IDS) {
  test(`${model} rejects stale, missing, and off-by-one schema prompt limits`, async () => {
    for (const maxLength of [7999, 8001, 20000, 32000, undefined]) {
      const snapshot = structuredClone(schemas);
      snapshot[model].properties.prompt.maxLength = maxLength;
      const result = await checkLiveContract({ fetchImpl: schemaFetch(snapshot) });
      assert.equal(result.ok, false);
      assert.deepEqual(result.checks.filter((c) => !c.ok).map((c) => c.model), [model]);
      assert.equal(result.checks.find((c) => c.model === model).promptMaxLength, maxLength);
    }
  });
}

test("8000 prompt limits do not hide other contract violations", async () => {
  for (const model of ALL_MODEL_IDS) {
    for (const mutate of [
      (schema) => { schema.required = []; },
      (schema) => { schema.properties.aspect_ratio.default = "unsupported"; },
      (schema) => { schema.properties.aspect_ratio.enum = ["unsupported"]; },
      (schema) => { schema.properties.prompt.minLength = 0; },
      (schema) => { schema.properties.model.enum = ["unsupported"]; },
      ...(schemas[model].properties.image_urls ? [
        (schema) => { schema.properties.image_urls.maxItems = 17; },
      ] : []),
    ]) {
      const snapshot = structuredClone(schemas);
      mutate(snapshot[model]);
      const result = await checkLiveContract({ fetchImpl: schemaFetch(snapshot) });
      assert.equal(result.ok, false);
      assert.deepEqual(result.checks.filter((c) => !c.ok).map((c) => c.model), [model]);
    }
  }
});
