import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";

export const SKILL_ID = "hiapi-gpt-image-2-5";
export const SKILL_VERSION = "0.1.0";
export const MODELS = Object.freeze({
  flare: "gpt-image-2.5-flare",
  sunburst: "gpt-image-2.5-sunburst",
});
export const DEFAULT_BASE_URL = "https://api.hiapi.ai";
export const DEFAULT_SITE_URL = "https://www.hiapi.ai";
export const DEFAULT_SKILLS_MANIFEST_URL =
  "https://raw.githubusercontent.com/HiAPIAI/hiapi-skills/main/skills.json";
export const DEFAULT_REPOSITORY_POLICY_URL =
  "https://raw.githubusercontent.com/HiAPIAI/hiapi-gpt-image-2-5-skill/main/update-policy.json";
export const UPDATE_COMMAND =
  'npx --yes --package=github:HiAPIAI/hiapi-gpt-image-2-5-skill hiapi-gpt-image-2-5-install --target="${AGENT_SKILLS_DIR:-$HOME/.codex/skills}" --force';
export const ASPECT_RATIOS = new Set([
  "1:1",
  "3:2",
  "2:3",
  "4:3",
  "3:4",
  "16:9",
  "9:16",
  "auto",
  "1024x1024",
  "1536x1024",
  "1024x1536",
  "1536x1152",
  "1152x1536",
  "2048x2048",
  "2048x1152",
  "1152x2048",
  "3840x2160",
  "2160x3840",
]);
export const QUALITIES = new Set([
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
  "auto",
]);
export const BACKGROUNDS = new Set(["auto", "transparent", "opaque"]);
export const FORMATS = new Set(["png", "jpeg", "webp"]);
export const MAX_IMAGES = 16;
export const POLL_INTERVAL_MS = 3000;
export const DEFAULT_TIMEOUT_MINUTES = 30;
export const HIAPI_API_KEYS_URL = "https://www.hiapi.ai/en/dashboard/api-keys";
export const HIAPI_DASHBOARD_URL = "https://www.hiapi.ai/en/dashboard";
export const HIAPI_PRICING_URL = "https://www.hiapi.ai/en/pricing";

export function resolveConfig(env = process.env) {
  const apiKey = String(env.HIAPI_API_KEY || "").trim();
  if (!apiKey)
    throw new Error(
      `HIAPI_API_KEY is required for task creation or recovery. Get one at ${HIAPI_API_KEYS_URL}.`,
    );
  const baseUrl = String(env.HIAPI_BASE_URL || DEFAULT_BASE_URL).replace(
    /\/+$/,
    "",
  );
  if (!/^https?:\/\//.test(baseUrl))
    throw new Error("HIAPI_BASE_URL must start with http:// or https://.");
  return { apiKey, baseUrl };
}
function list(value) {
  if (value == null || value === "") return [];
  return (Array.isArray(value) ? value : [value])
    .map((v) => String(v).trim())
    .map((v) => {
      if (!v) throw new Error("image_urls entries must not be empty.");
      return v;
    });
}
function enumValue(value, fallback, allowed, name) {
  const v = String(value ?? fallback)
    .trim()
    .toLowerCase();
  if (!allowed.has(v))
    throw new Error(
      `Unsupported ${name} "${value}". Use one of: ${[...allowed].join(", ")}.`,
    );
  return v;
}
export function normalizeModel(value = MODELS.flare) {
  const v = String(value).trim();
  if (!Object.values(MODELS).includes(v))
    throw new Error(
      `Unsupported model ID "${v}". Use gpt-image-2.5-flare or gpt-image-2.5-sunburst.`,
    );
  return v;
}
export function normalizeAspectRatio(value) {
  return enumValue(value, "1:1", ASPECT_RATIOS, "aspect ratio");
}
export function normalizeQuality(value) {
  return enumValue(value, "medium", QUALITIES, "quality");
}
export function normalizeBackground(value) {
  return enumValue(value, "auto", BACKGROUNDS, "background");
}
export function normalizeOutputFormat(value) {
  return enumValue(value, "webp", FORMATS, "output format");
}
export function normalizeImageUrls(value) {
  if (Array.isArray(value) && value.length === 0)
    throw new Error(
      "image_urls must be omitted for text-to-image; an empty array is invalid.",
    );
  const urls = list(value);
  if (urls.length > MAX_IMAGES)
    throw new Error(`At most ${MAX_IMAGES} reference images are supported.`);
  for (const raw of urls) {
    let url;
    try {
      url = new URL(raw);
    } catch {
      throw new Error("image_urls entries must be valid HTTP(S) URLs.");
    }
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password
    )
      throw new Error(
        "image_urls entries must be public HTTP(S) URLs without credentials.",
      );
  }
  return urls;
}
export function buildImagePayload(options = {}) {
  const prompt = String(options.prompt || "").trim();
  if (!prompt)
    throw new Error(
      "A non-empty prompt is required for a new GPT Image 2.5 task.",
    );
  if (prompt.length > 32000)
    throw new Error("prompt must be at most 32000 characters.");
  const model = normalizeModel(
    options.model || options.modelId || MODELS.flare,
  );
  const imageUrls = normalizeImageUrls(options.imageUrls ?? options.image_urls);
  const background = normalizeBackground(options.background);
  const format = normalizeOutputFormat(
    options.outputFormat ?? options.output_format,
  );
  if (background === "transparent" && !["png", "webp"].includes(format))
    throw new Error("transparent background requires png or webp output.");
  const input = {
    prompt,
    aspect_ratio: normalizeAspectRatio(
      options.aspectRatio ?? options.aspect_ratio,
    ),
    quality: normalizeQuality(options.quality),
    background,
    output_format: format,
  };
  if (imageUrls.length) input.image_urls = imageUrls;
  return { model, input };
}
export function redactPayload(payload) {
  const clone = structuredClone(payload);
  if (clone.input?.image_urls)
    clone.input.image_urls = clone.input.image_urls.map(
      () => "[redacted-image-url]",
    );
  return clone;
}
export function extractTaskId(body) {
  return (
    body?.data?.taskId ||
    body?.data?.task_id ||
    body?.taskId ||
    body?.task_id ||
    null
  );
}
export function extractStatus(body) {
  return String(body?.data?.status || body?.status || "").toLowerCase();
}
export function extractImageUrl(body) {
  const output = body?.data?.output ?? body?.output;
  const items = Array.isArray(output) ? output : output ? [output] : [];
  for (const item of items) {
    if (
      typeof item === "object" &&
      item?.type &&
      String(item.type).toLowerCase() !== "image"
    )
      continue;
    const url = typeof item === "string" ? item : item?.url || item?.image_url;
    if (url && (/^https?:\/\//.test(url) || /^data:image\//.test(url)))
      return url;
  }
  return body?.data?.image_url || body?.image_url || null;
}
const terminal = new Set(["failed", "fail", "error", "cancelled", "canceled"]);
export function isTerminalFailureStatus(status) {
  return terminal.has(String(status || "").toLowerCase());
}
function summary(body) {
  return String(
    body?.error?.message ||
      body?.data?.error?.message ||
      body?.message ||
      body?.data?.message ||
      body ||
      "Unknown error",
  ).slice(0, 600);
}
export function buildHttpErrorMessage(status, body) {
  const s = summary(body);
  if (status === 401 || status === 403)
    return `HiAPI request failed with HTTP ${status}: ${s}\nCheck HIAPI_API_KEY at ${HIAPI_API_KEYS_URL}.`;
  if (status === 402 || /balance|credit|quota|payment/i.test(s))
    return `HiAPI request failed with HTTP ${status}: ${s}\nCheck balance at ${HIAPI_DASHBOARD_URL} and pricing at ${HIAPI_PRICING_URL}.`;
  if (status === 429)
    return `HiAPI request failed with HTTP 429: ${s}\nWait and retry.`;
  if (status === 400)
    return `HiAPI request failed with HTTP 400: ${s}\nRun --dry-run and check the current schema.`;
  return `HiAPI request failed with HTTP ${status}: ${s}`;
}
export async function requestJson(url, options = {}, fetchImpl = fetch) {
  let response;
  try {
    response = await fetchWithBodyTimeout(
      fetchImpl,
      url,
      options,
      options.requestTimeoutMs,
    );
  } catch (e) {
    const err = new Error(`Network request failed: ${e?.message || e}`);
    err.cause = e;
    throw err;
  }
  const text = response._bodyText;
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!response.ok) {
    const err = new Error(buildHttpErrorMessage(response.status, body));
    err.httpStatus = response.status;
    throw err;
  }
  if (body?.code !== undefined && Number(body.code) !== 200)
    throw new Error(`HiAPI API error code ${body.code}: ${summary(body)}`);
  return body;
}
async function fetchWithBodyTimeout(
  fetchImpl,
  url,
  options = {},
  timeoutMs = 15000,
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      ...options,
      signal: controller.signal,
    });
    response._bodyText = await response.text();
    return response;
  } finally {
    clearTimeout(timer);
  }
}
async function boundedFetch(fetchImpl, url, options = {}, timeoutMs = 15000) {
  return fetchWithBodyTimeout(fetchImpl, url, options, timeoutMs);
}
async function fetchBinaryTimeout(
  fetchImpl,
  url,
  options = {},
  timeoutMs = 15000,
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      ...options,
      signal: controller.signal,
    });
    const bytes = new Uint8Array(await response.arrayBuffer());
    return { response, bytes };
  } finally {
    clearTimeout(timer);
  }
}
function readJsonBounded(response) {
  const text = response._bodyText ?? "";
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    throw new Error("HiAPI returned invalid JSON.");
  }
}
function parseJsonText(text) {
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    throw new Error("HiAPI returned invalid JSON.");
  }
}
export async function createImageTask(
  payload,
  config = resolveConfig(),
  options = {},
) {
  if (
    options.idempotencyKey !== undefined &&
    (!String(options.idempotencyKey).trim() ||
      /[\u0000-\u001f\u007f]/.test(String(options.idempotencyKey)))
  )
    throw new Error(
      "idempotency-key must be non-empty and contain no control characters.",
    );
  const idempotencyKey = String(options.idempotencyKey || randomUUID()).trim();
  if (Buffer.byteLength(idempotencyKey, "utf8") > 255)
    throw new Error("idempotency-key must be at most 255 UTF-8 bytes.");
  const response = await requestJson(
    `${config.baseUrl}/v1/tasks`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(payload),
    },
    options.fetchImpl || fetch,
  );
  const taskId = extractTaskId(response);
  if (!taskId)
    throw new Error(
      "HiAPI response did not return a task ID; task acceptance is unknown. Reuse the same idempotency key before retrying.",
    );
  return { taskId, idempotencyKey, response };
}
export async function getTask(
  taskId,
  config = resolveConfig(),
  fetchImpl = fetch,
) {
  return requestJson(
    `${config.baseUrl}/v1/tasks/${encodeURIComponent(taskId)}`,
    {
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        Accept: "application/json",
      },
    },
    fetchImpl,
  );
}
export async function waitForImage(
  taskId,
  config = resolveConfig(),
  options = {},
) {
  const timeoutMs =
    Number(options.timeoutMinutes || DEFAULT_TIMEOUT_MINUTES) * 60000;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0)
    throw new Error("timeoutMinutes must be a positive finite number.");
  const deadline = Date.now() + timeoutMs;
  let failures = 0;
  while (Date.now() < deadline) {
    let body;
    try {
      body = await getTask(taskId, config, options.fetchImpl || fetch);
      failures = 0;
    } catch (e) {
      if (
        ![429, 500, 502, 503, 504].includes(e.httpStatus) &&
        !String(e.message).startsWith("Network request failed")
      )
        throw e;
      failures++;
      await sleep(
        Math.min(POLL_INTERVAL_MS * 2 ** Math.min(failures, 3), 30000),
      );
      continue;
    }
    const status = extractStatus(body);
    const imageUrl = extractImageUrl(body);
    if (["success", "succeeded", "completed", "complete"].includes(status)) {
      if (!imageUrl)
        throw new Error(
          `Task ${taskId} succeeded but returned no image output.`,
        );
      return { response: body, imageUrl };
    }
    if (isTerminalFailureStatus(status))
      throw new Error(`Image generation failed: ${summary(body)}`);
    await sleep(Number(options.pollIntervalMs ?? POLL_INTERVAL_MS));
  }
  throw new Error(
    `Image generation timed out. Task ${taskId} may still be running; resume with --resume-task-id ${taskId}.`,
  );
}
export async function saveImageOutput(
  imageUrl,
  outputDir = "outputs",
  options = {},
) {
  if (!imageUrl || !/^https?:\/\//.test(imageUrl))
    return imageUrl ? { kind: "data-uri", value: imageUrl } : null;
  const downloaded = await fetchBinaryTimeout(
    options.fetchImpl || fetch,
    imageUrl,
    {},
    options.downloadTimeoutMs || 15000,
  );
  const response = downloaded.response;
  if (!response.ok)
    throw new Error(
      `Image download failed with HTTP ${response.status}; resume task if the URL expired.`,
    );
  const bytes = downloaded.bytes;
  const type = (response.headers.get("content-type") || "")
    .split(";", 1)[0]
    .toLowerCase();
  const signature =
    bytes.length >= 12 &&
    (bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
      ? "image/png"
      : bytes[0] === 0xff && bytes[1] === 0xd8
        ? "image/jpeg"
        : String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
            String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
          ? "image/webp"
          : null);
  if (!signature || type !== signature)
    throw new Error(
      `Downloaded output is not a valid ${type || "image"}; resume task ${options.taskId || "from the task"}.`,
    );
  const ext = /png/.test(signature)
    ? ".png"
    : /jpeg/.test(signature)
      ? ".jpg"
      : ".webp";
  const dir = resolve(outputDir);
  await mkdir(dir, { recursive: true });
  const path = join(dir, `gpt-image-2-5-${timestamp()}-${randomUUID()}${ext}`);
  await writeFile(path, bytes);
  return { kind: "file", path, value: path, sourceUrl: imageUrl };
}
export async function generateImage(options = {}, config = resolveConfig()) {
  let taskId = String(options.resumeTaskId || "").trim();
  let idempotencyKey = options.idempotencyKey || null;
  let model = null;
  if (!taskId) {
    await warnOrRequireSkillUpdate({ fetchImpl: options.fetchImpl || fetch });
    if (
      options.timeoutMinutes !== undefined &&
      (!Number.isFinite(Number(options.timeoutMinutes)) ||
        Number(options.timeoutMinutes) <= 0)
    ) {
      throw new Error("timeoutMinutes must be a positive finite number.");
    }
    const payload = buildImagePayload(options);
    model = payload.model;
    idempotencyKey ||= randomUUID();
    console.error(`HiAPI idempotency key: ${idempotencyKey}`);
    let created;
    try {
      created = await createImageTask(payload, config, {
        idempotencyKey,
        fetchImpl: options.fetchImpl,
      });
    } catch (e) {
      if (String(e.message).startsWith("Network request failed"))
        throw new Error(
          `${e.message}\nAcceptance is unknown; retry with --idempotency-key ${idempotencyKey}, do not blindly create another task.`,
        );
      throw e;
    }
    taskId = created.taskId;
    console.error(`HiAPI task created: ${taskId}`);
  } else console.error(`Resuming HiAPI task: ${taskId}`);
  if (options.wait === false)
    return { ok: true, taskId, model, idempotencyKey, status: "submitted" };
  const finished = await waitForImage(taskId, config, options);
  const output =
    options.save === false
      ? { kind: "url", value: finished.imageUrl }
      : await saveImageOutput(finished.imageUrl, options.outputDir, options);
  return {
    ok: true,
    taskId,
    model:
      model ||
      finished.response?.data?.model ||
      finished.response?.model ||
      null,
    idempotencyKey,
    status: "success",
    output,
  };
}
export async function fetchPricingEstimate(payload, options = {}) {
  const siteUrl = (
    options.siteUrl ||
    process.env.HIAPI_SITE_URL ||
    DEFAULT_SITE_URL
  ).replace(/\/+$/, "");
  const response = await boundedFetch(
    options.fetchImpl || fetch,
    `${siteUrl}/api/pricing`,
    { headers: { Accept: "application/json" } },
  );
  if (!response.ok)
    throw new Error(`Pricing check failed with HTTP ${response.status}.`);
  const body = parseJsonText(response._bodyText);
  const row = body?.data?.find((entry) => entry?.model_name === payload.model);
  if (!row)
    throw new Error(`Current public pricing does not list ${payload.model}.`);
  const policy = (row.policies || []).find((p) =>
    Object.entries(p.rule || {}).every(
      ([k, v]) => payload.input[k] === v.match,
    ),
  );
  const unitUsd = Number(policy?.usd_value ?? row.base_usd_value);
  return {
    model: payload.model,
    unitUsd,
    estimatedUsd: Number.isFinite(unitUsd) ? Number(unitUsd.toFixed(4)) : null,
    billingBasis:
      row.base_display_unit?.en || "current public pricing snapshot",
    pricingPage: HIAPI_PRICING_URL,
    note: "Estimate only; final billing follows the accepted task.",
  };
}
export async function checkLiveContract(options = {}) {
  const siteUrl = (
    options.siteUrl ||
    process.env.HIAPI_SITE_URL ||
    DEFAULT_SITE_URL
  ).replace(/\/+$/, "");
  const fetchImpl = options.fetchImpl || fetch;
  const checks = [];
  for (const model of Object.values(MODELS)) {
    const response = await boundedFetch(
      fetchImpl,
      `${siteUrl}/api/models/content?name=${encodeURIComponent(model)}`,
      { headers: { Accept: "application/json" } },
    );
    if (!response.ok)
      throw new Error(
        `Contract check failed for ${model}: HTTP ${response.status}.`,
      );
    const schema = parseJsonText(response._bodyText)?.data?.input_schema;
    const props = schema?.properties || {};
    const expected = [
      "prompt",
      "image_urls",
      "aspect_ratio",
      "quality",
      "background",
      "output_format",
    ];
    const wrapper = props.model?.enum?.includes(model);
    const requiredExact =
      JSON.stringify([...(schema.required || [])].sort()) ===
      JSON.stringify(["model", "prompt"]);
    const core = expected.every((field) => props[field]);
    const enumMatches = (field, values) =>
      JSON.stringify(props[field]?.enum || []) === JSON.stringify(values);
    const ok =
      !!schema &&
      wrapper &&
      requiredExact &&
      core &&
      props.image_urls?.minItems === 1 &&
      props.image_urls?.maxItems === 16 &&
      props.prompt?.minLength === 1 &&
      props.prompt?.maxLength === 32000 &&
      JSON.stringify(props.aspect_ratio?.enum) ===
        JSON.stringify([
          "1:1",
          "3:2",
          "2:3",
          "4:3",
          "3:4",
          "16:9",
          "9:16",
          "auto",
          "1024x1024",
          "1536x1024",
          "1024x1536",
          "1536x1152",
          "1152x1536",
          "2048x2048",
          "2048x1152",
          "1152x2048",
          "3840x2160",
          "2160x3840",
        ]) &&
      props.aspect_ratio?.default === "1:1" &&
      props.prompt?.minLength === 1 &&
      props.image_urls?.minItems === 1 &&
      enumMatches("quality", [...QUALITIES]) &&
      props.quality?.default === "medium" &&
      enumMatches("background", [...BACKGROUNDS]) &&
      props.background?.default === "auto" &&
      enumMatches("output_format", [...FORMATS]) &&
      props.output_format?.default === "webp";
    checks.push({
      model,
      ok,
      wrapperModelProperty: wrapper,
      required: schema?.required || [],
      properties: Object.keys(props),
      imageUrlsMax: props.image_urls?.maxItems,
    });
  }
  return {
    ok: checks.every((c) => c.ok),
    checkedAt: new Date().toISOString(),
    checks,
  };
}
export function compareVersions(a, b) {
  const x = String(a).split(".").map(Number),
    y = String(b).split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0) ? 1 : -1;
  }
  return 0;
}
export async function checkSkillUpdate(options = {}) {
  if (
    ["1", "true"].includes(
      String(
        (options.env || process.env).HIAPI_SKIP_UPDATE_CHECK || "",
      ).toLowerCase(),
    )
  )
    return {
      status: "unverified",
      message: `Version verification is disabled. New paid tasks require the latest skill. Update: ${UPDATE_COMMAND}`,
    };
  for (const url of options.manifestUrls || [
    DEFAULT_SKILLS_MANIFEST_URL,
    DEFAULT_REPOSITORY_POLICY_URL,
  ]) {
    try {
      const r = await boundedFetch(
        options.fetchImpl || fetch,
        url,
        {
          headers: { Accept: "application/json" },
        },
        options.requestTimeoutMs || 15000,
      );
      if (!r.ok) continue;
      const m = parseJsonText(r._bodyText);
      const s = Array.isArray(m.skills)
        ? m.skills.find((x) => x?.id === SKILL_ID)
        : m.id === SKILL_ID
          ? m
          : null;
      if (s?.updatePolicy)
        return evaluate(
          s.updatePolicy,
          options.currentVersion || SKILL_VERSION,
        );
    } catch {}
  }
  return {
    status: "unverified",
    message: `Could not verify the latest skill version; continuing with local validation. Update: ${UPDATE_COMMAND}`,
  };
}
function evaluate(policy, current) {
  const min = policy.minimumVersion || current,
    latest = policy.latestVersion || min;
  if (compareVersions(current, min) < 0)
    return {
      status: "required",
      latestVersion: latest,
      minimumVersion: min,
      message: `${policy.requiredNotice || "This skill version is incompatible."} Update now: ${policy.updateCommand || UPDATE_COMMAND}`,
    };
  if (compareVersions(current, latest) < 0)
    return {
      status: "available",
      latestVersion: latest,
      minimumVersion: min,
      message: `${policy.notice || "A newer skill version is available."} Update: ${policy.updateCommand || UPDATE_COMMAND}`,
    };
  return { status: "current", latestVersion: latest, minimumVersion: min };
}
export async function warnOrRequireSkillUpdate(options = {}) {
  const r = await checkSkillUpdate(options);
  if (r.status === "required" && !options.allowRecovery)
    throw new Error(r.message);
  if (r.message) console.error(r.message);
  return r;
}
export function parseArgs(argv) {
  const o = { outputDir: "outputs" };
  const repeat = { "--image-url": "imageUrls" };
  const values = {
    "--prompt": "prompt",
    "--model": "model",
    "--aspect-ratio": "aspectRatio",
    "--aspect": "aspectRatio",
    "--quality": "quality",
    "--background": "background",
    "--output-format": "outputFormat",
    "--output-dir": "outputDir",
    "--timeout-minutes": "timeoutMinutes",
    "--resume-task-id": "resumeTaskId",
    "--idempotency-key": "idempotencyKey",
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") o.help = true;
    else if (a === "--dry-run") o.dryRun = true;
    else if (a === "--estimate") o.estimate = true;
    else if (a === "--check-contract") o.checkContract = true;
    else if (a === "--no-wait") o.wait = false;
    else if (a === "--no-save") o.save = false;
    else if (repeat[a]) {
      const v = argv[++i];
      if (!v || v.startsWith("--")) throw new Error(`${a} requires a value.`);
      (o[repeat[a]] ||= []).push(v);
    } else if (values[a]) {
      const v = argv[++i];
      if (v === undefined || v.startsWith("--"))
        throw new Error(`${a} requires a value.`);
      o[values[a]] = v;
    } else if (!a.startsWith("--") && !o.prompt) o.prompt = a;
    else throw new Error(`Unknown argument: ${a}`);
  }
  if (o.resumeTaskId && (o.dryRun || o.estimate || o.checkContract))
    throw new Error(
      "--resume-task-id cannot be combined with preflight options.",
    );
  return o;
}
export function usage() {
  return `HiAPI GPT Image 2.5 skill\n\nPreflight: node scripts/hiapi-gpt-image-2-5.mjs --model gpt-image-2.5-flare --prompt "..." --dry-run --estimate\nCreate: node scripts/hiapi-gpt-image-2-5.mjs --prompt "..."\nRecover: node scripts/hiapi-gpt-image-2-5.mjs --resume-task-id <task-id>\nOptions: --model <gpt-image-2.5-flare|gpt-image-2.5-sunburst>, --image-url <url> (repeatable, max 16), --aspect-ratio <schema enum>, --quality <low|medium|high|xhigh|max|auto>, --background <auto|transparent|opaque>, --output-format <png|jpeg|webp>, --dry-run, --estimate, --no-wait, --no-save, --idempotency-key <key>, --resume-task-id <id>`;
}
function timestamp() {
  return new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\..+/, "")
    .replace("T", "-");
}
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
