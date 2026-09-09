import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import {
  checkSkillUpdate,
  createImageTask,
  extractImageUrl,
  generateImage,
  normalizeImageUrls,
  parseArgs,
  saveImageOutput,
  waitForImage,
  MODELS,
} from "../scripts/lib/gpt-image-2-5.mjs";

const config = { apiKey: "test-key", baseUrl: "http://mock.local" };
const runtime = resolve(new URL("../scripts/hiapi-gpt-image-2-5.mjs", import.meta.url).pathname);
const installer = resolve(new URL("../scripts/install.mjs", import.meta.url).pathname);

function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

function policyResponse({ latestVersion = "0.1.0", minimumVersion = "0.1.0" } = {}) {
  return json({
    skills: [{
      id: "hiapi-gpt-image-2-5",
      updatePolicy: {
        latestVersion,
        minimumVersion,
        updateCommand: "update-command",
        notice: "soft update",
        requiredNotice: "hard update",
      },
    }],
  });
}

function updateFetch(policyOptions) {
  return async (url) => {
    if (String(url).includes("hiapi-skills")) return policyResponse(policyOptions);
    return policyResponse(policyOptions);
  };
}

test("soft update warns and still submits exactly one task", async () => {
  let posts = 0;
  const fetchImpl = async (url, options = {}) => {
    if (String(url).endsWith("/v1/tasks")) {
      posts += 1;
      assert.equal(options.headers["Idempotency-Key"], "soft-key");
      return json({ data: { taskId: "soft-task" } });
    }
    return policyResponse({ latestVersion: "0.2.0" });
  };
  const result = await generateImage(
    { prompt: "soft", noWait: true, wait: false, idempotencyKey: "soft-key", fetchImpl },
    config,
  );
  assert.equal(result.taskId, "soft-task");
  assert.equal(posts, 1);
});

test("hard update blocks new creation before POST", async () => {
  let posts = 0;
  const fetchImpl = async (url) => {
    if (String(url).endsWith("/v1/tasks")) {
      posts += 1;
      return json({ data: { taskId: "must-not-exist" } });
    }
    return policyResponse({ latestVersion: "0.2.0", minimumVersion: "0.2.0" });
  };
  await assert.rejects(
    generateImage({ prompt: "blocked", wait: false, fetchImpl }, config),
    /hard update|incompatible|update/i,
  );
  assert.equal(posts, 0);
});

test("unavailable update endpoints leave creation usable", async () => {
  let posts = 0;
  const fetchImpl = async (url) => {
    if (String(url).endsWith("/v1/tasks")) {
      posts += 1;
      return json({ data: { taskId: "offline-update-task" } });
    }
    throw new Error("update endpoint unavailable");
  };
  const result = await generateImage(
    { prompt: "continue", wait: false, idempotencyKey: "offline-key", fetchImpl },
    config,
  );
  assert.equal(result.taskId, "offline-update-task");
  assert.equal(posts, 1);
});

test("an update response whose body never ends is bounded", async () => {
  const server = createServer((_request, response) => {
    response.writeHead(200, { "content-type": "application/json" });
    response.write("{");
  });
  await new Promise((resolveReady) => server.listen(0, "127.0.0.1", resolveReady));
  const { port } = server.address();
  try {
    const started = Date.now();
    const result = await checkSkillUpdate({
      manifestUrls: [`http://127.0.0.1:${port}/policy`],
      requestTimeoutMs: 100,
    });
    assert.equal(result.status, "unverified");
    assert.ok(Date.now() - started < 2000);
  } finally {
    await new Promise((resolveClosed) => server.close(resolveClosed));
  }
});

test("ambiguous create keeps one idempotency handle and recovery does not POST", async () => {
  let posts = 0;
  const createFetch = async (url) => {
    if (String(url).endsWith("/v1/tasks")) {
      posts += 1;
      return json({ code: 200, data: {} });
    }
    return policyResponse();
  };
  await assert.rejects(
    generateImage({ prompt: "ambiguous", wait: false, idempotencyKey: "same-key", fetchImpl: createFetch }, config),
    /task ID/i,
  );
  assert.equal(posts, 1);

  let recoveryPosts = 0;
  const recoveryFetch = async (url) => {
    if (String(url).endsWith("/v1/tasks")) recoveryPosts += 1;
    return json({ data: { status: "success", output: [{ type: "image", url: "https://cdn.test/recovered.png" }] } });
  };
  const recovered = await generateImage(
    { resumeTaskId: "known-task", save: false, fetchImpl: recoveryFetch, pollIntervalMs: 0, timeoutMinutes: 1 },
    config,
  );
  assert.equal(recovered.output.value, "https://cdn.test/recovered.png");
  assert.equal(recoveryPosts, 0);
});

test("mixed outputs select an image and ignore video or thumbnail entries", () => {
  assert.equal(
    extractImageUrl({ data: { output: [
      { type: "video", url: "https://cdn.test/video.mp4" },
      { type: "thumbnail", url: "https://cdn.test/thumb.jpg" },
      { type: "image", url: "https://cdn.test/final.webp" },
    ] } }),
    "https://cdn.test/final.webp",
  );
});

test("success without an image fails immediately", async () => {
  await assert.rejects(
    waitForImage(
      "no-image",
      config,
      {
        fetchImpl: async () => json({ data: { status: "success", output: [] } }),
        pollIntervalMs: 0,
        timeoutMinutes: 1,
      },
    ),
    /no image output/i,
  );
});

test("HTTP and HTML download failures are rejected", async () => {
  await assert.rejects(
    saveImageOutput("https://cdn.test/fail.webp", await mkdtemp(join(tmpdir(), "img25-test-")), {
      fetchImpl: async () => new Response("upstream failure", { status: 502 }),
    }),
    /download|HTTP 502|failed/i,
  );
  await assert.rejects(
    saveImageOutput("https://cdn.test/html.webp", await mkdtemp(join(tmpdir(), "img25-test-")), {
      fetchImpl: async () => new Response("<!doctype html><title>login</title>", {
        status: 200,
        headers: { "content-type": "text/html" },
      }),
    }),
    /image|HTML|content/i,
  );
});

test("PNG, JPEG, and WebP outputs use matching extensions", async () => {
  const outputDir = await mkdtemp(join(tmpdir(), "img25-formats-"));
  for (const [contentType, extension, bytes] of [
    ["image/png", ".png", new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 0, 0, 0, 0])],
    ["image/jpeg", ".jpg", new Uint8Array([0xff, 0xd8, 0xff, 0xd9, 0, 0, 0, 0, 0, 0, 0, 0])],
    ["image/webp", ".webp", new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50])],
  ]) {
    const result = await saveImageOutput(`https://cdn.test/file${extension}`, outputDir, {
      fetchImpl: async () => new Response(bytes, {
        status: 200,
        headers: { "content-type": contentType },
      }),
    });
    assert.equal(result.kind, "file");
    assert.ok(result.path.endsWith(extension));
  }
  assert.equal((await readdir(outputDir)).length, 3);
});

test("concurrent downloads do not overwrite one another", async () => {
  const outputDir = await mkdtemp(join(tmpdir(), "img25-concurrent-"));
  const webpA = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 1]);
  const webpB = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 2]);
  const results = await Promise.all([
    saveImageOutput("https://cdn.test/a.webp", outputDir, {
      fetchImpl: async () => new Response(webpA, { headers: { "content-type": "image/webp" } }),
    }),
    saveImageOutput("https://cdn.test/b.webp", outputDir, {
      fetchImpl: async () => new Response(webpB, { headers: { "content-type": "image/webp" } }),
    }),
  ]);
  assert.notEqual(results[0].path, results[1].path);
  assert.equal((await readdir(outputDir)).length, 2);
  assert.notDeepEqual(await readFile(results[0].path), await readFile(results[1].path));
});

test("empty image_urls and empty URL entries are rejected", () => {
  assert.throws(() => normalizeImageUrls([]), /empty array/i);
  assert.throws(() => normalizeImageUrls([""]), /empty|HTTP\(S\)|valid/i);
});

test("invalid timeout and idempotency are rejected before POST", async () => {
  let posts = 0;
  const fetchImpl = async (url) => {
    if (String(url).endsWith("/v1/tasks")) posts += 1;
    return policyResponse();
  };
  await assert.rejects(
    generateImage({ prompt: "timeout", timeoutMinutes: 0, wait: false, fetchImpl }, config),
    /timeoutMinutes/i,
  );
  await assert.rejects(
    createImageTask(
      { model: MODELS.flare, input: { prompt: "idem" } },
      config,
      { idempotencyKey: "x".repeat(256), fetchImpl },
    ),
    /255|idempotency/i,
  );
  await assert.rejects(
    createImageTask(
      { model: MODELS.flare, input: { prompt: "blank-idem" } },
      config,
      { idempotencyKey: "   ", fetchImpl },
    ),
    /idempotency/i,
  );
  await assert.rejects(
    createImageTask(
      { model: MODELS.flare, input: { prompt: "control-idem" } },
      config,
      { idempotencyKey: "ok\nno", fetchImpl },
    ),
    /idempotency|control/i,
  );
  assert.equal(posts, 0);
});

test("unknown CLI flags are rejected", () => {
  assert.throws(() => parseArgs(["--not-a-real-flag"]), /Unknown argument/i);
});

test("CLI options cannot consume another flag as a missing value", () => {
  for (const option of ["--prompt", "--image-url", "--resume-task-id", "--model"]) {
    assert.throws(() => parseArgs([option, "--dry-run"]), /requires a value/i);
  }
});

test("installer requires target and protects the destination", async () => {
  const missingTarget = spawnSync(process.execPath, [installer], { encoding: "utf8" });
  assert.notEqual(missingTarget.status, 0);
  assert.match(`${missingTarget.stdout}\n${missingTarget.stderr}`, /target/i);

  const target = await mkdtemp(join(tmpdir(), "img25-install-"));
  const installed = spawnSync(process.execPath, [installer, "--target", target], { encoding: "utf8" });
  assert.equal(installed.status, 0, installed.stderr);
  const destination = join(target, "hiapi-gpt-image-2-5");
  await stat(join(destination, "SKILL.md"));
  await assert.rejects(
    stat(join(destination, ".env")),
    { code: "ENOENT" },
  );
  await assert.rejects(stat(join(destination, ".env.local")), { code: "ENOENT" });
  await assert.rejects(stat(join(destination, ".git")), { code: "ENOENT" });
  await assert.rejects(stat(join(destination, "outputs")), { code: "ENOENT" });

  const protectedRun = spawnSync(process.execPath, [installer, "--target", target], { encoding: "utf8" });
  assert.notEqual(protectedRun.status, 0);
  assert.match(`${protectedRun.stdout}\n${protectedRun.stderr}`, /non-empty|Refusing/i);

  const sourceRun = spawnSync(process.execPath, [installer, "--target", resolve(installer, "..")], { encoding: "utf8" });
  assert.notEqual(sourceRun.status, 0);
  assert.match(`${sourceRun.stdout}\n${sourceRun.stderr}`, /source|itself|subdirectory|refus/i);
});

test("installer refuses a destination skill symlink", async () => {
  const target = await mkdtemp(join(tmpdir(), "img25-symlink-"));
  const linked = await mkdtemp(join(tmpdir(), "img25-linked-"));
  const { symlink } = await import("node:fs/promises");
  await symlink(linked, join(target, "hiapi-gpt-image-2-5"));
  const result = spawnSync(process.execPath, [installer, "--target", target], { encoding: "utf8" });
  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}\n${result.stderr}`, /symlink|symbolic|refus/i);
});

test("a normal preflight subprocess exits promptly", () => {
  const started = Date.now();
  const result = spawnSync(process.execPath, [runtime, "--prompt", "quick", "--dry-run"], {
    encoding: "utf8",
    timeout: 2000,
    env: { ...process.env, HIAPI_SKIP_UPDATE_CHECK: "1" },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.ok(Date.now() - started < 1500);
});
