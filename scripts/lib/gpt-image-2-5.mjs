import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";

export const SKILL_ID = "hiapi-gpt-image-2-5";
export const SKILL_VERSION = "0.4.0";
// Family base names. Never sent as a model ID: the bare IDs are not a
// supported request route; use a mode ID or the `@pro` route instead.
export const FAMILIES = Object.freeze({
  flare: "gpt-image-2.5-flare",
  sunburst: "gpt-image-2.5-sunburst",
});
// Pro route: priced by `framing` × `resolution` × `quality`, selected with
// --route pro or an explicit `@pro` model ID.
export const PRO_MODELS = Object.freeze({
  flare: "gpt-image-2.5-flare@pro",
  sunburst: "gpt-image-2.5-sunburst@pro",
});
export const ROUTES = new Set(["mode", "pro"]);
// Mode IDs: priced by `resolution`; the default route, chosen by whether
// reference images are supplied.
export const MODE_MODELS = Object.freeze({
  flareTextToImage: "gpt-image-2.5-flare/text-to-image",
  flareImageToImage: "gpt-image-2.5-flare/image-to-image",
  sunburstTextToImage: "gpt-image-2.5-sunburst/text-to-image",
  sunburstImageToImage: "gpt-image-2.5-sunburst/image-to-image",
});
export const ALL_MODEL_IDS = Object.freeze([
  ...Object.values(MODE_MODELS),
  ...Object.values(PRO_MODELS),
]);
export const TEXT_TO_IMAGE = "text-to-image";
export const IMAGE_TO_IMAGE = "image-to-image";
export const DEFAULT_BASE_URL = "https://api.hiapi.ai";
export const DEFAULT_SITE_URL = "https://api.hiapi.ai";
export const DEFAULT_SKILLS_MANIFEST_URL =
  "https://raw.githubusercontent.com/HiAPIAI/hiapi-skills/main/skills.json";
export const DEFAULT_REPOSITORY_POLICY_URL =
  "https://raw.githubusercontent.com/HiAPIAI/hiapi-gpt-image-2-5-skill/main/update-policy.json";
export const UPDATE_COMMAND =
  'for d in "$HOME/.claude/skills" "$HOME/.codex/skills"; do if [ -d "$d" ]; then npx --yes --package=github:HiAPIAI/hiapi-gpt-image-2-5-skill hiapi-gpt-image-2-5-install --target="$d" --force; fi; done';
// @pro image size: 15 ratios plus an exact `WxH` pixel size. Production
// publishes this as a JSON-Schema `pattern` (not an enum) and has no `auto`.
// Verified 2026-11-19 against
// https://api.hiapi.ai/api/models/content?name=gpt-image-2.5-flare@pro.
export const PRO_ASPECT_RATIO_PATTERN =
  "^(1:1|3:2|2:3|4:3|3:4|5:4|4:5|16:9|9:16|2:1|1:2|21:9|9:21|3:1|1:3|[1-9][0-9]{1,3}x[1-9][0-9]{1,3})$";
export const ASPECT_RATIOS = new Set([
  "1:1",
  "3:2",
  "2:3",
  "4:3",
  "3:4",
  "5:4",
  "4:5",
  "16:9",
  "9:16",
  "2:1",
  "1:2",
  "21:9",
  "9:21",
  "3:1",
  "1:3",
]);
// WxH arithmetic accepted by the backend (`pixelSizeViolation` in
// hiapi-backend service/modelparams/size_tier.go).
export const PRO_SIZE_EDGE_MIN = 16;
export const PRO_SIZE_EDGE_MAX = 3840;
export const PRO_SIZE_EDGE_MULTIPLE = 16;
export const PRO_SIZE_MIN_PIXELS = 655360;
export const PRO_SIZE_MAX_PIXELS = 8294400;
export const PRO_SIZE_MAX_ASPECT = 3;
// Pixel budget per resolution tier, used both as the ratio layout budget and
// as the WxH tier ceiling: 1K up to 2048×1024, 2K up to 2560×2048, 4K up to
// 3840×2160 (tierPixelBudget / tier1KMaxPixels / tier2KMaxPixels in the same
// backend file).
export const PRO_TIER_MAX_PIXELS = Object.freeze({
  "1K": 2097152,
  "2K": 5242880,
  "4K": 8294400,
});
// Framing thresholds (FramingSquareMax / FramingStandardMax defaults 1.3 / 2.0).
export const PRO_FRAMING_SQUARE_MAX = 1.3;
export const PRO_FRAMING_STANDARD_MAX = 2;
export const FRAMINGS = new Set(["square", "standard", "panorama"]);
export const QUALITIES = new Set([
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
]);
export const BACKGROUNDS = new Set(["auto", "transparent", "opaque"]);
export const MODE_ASPECT_RATIOS = new Set([
  "auto",
  "1:1",
  "3:2",
  "2:3",
  "4:3",
  "3:4",
  "16:9",
  "9:16",
  "21:9",
  "27:16",
  "16:27",
  "9:8",
  "8:9",
]);
export const RESOLUTIONS = new Set(["1K", "2K", "4K"]);
// Public `input.prompt.maxLength` for all six model IDs (raised on
// 2026-10-13). This is the character limit the API enforces; text-to-image
// additionally has a separate internal o200k token cap that returns
// PROMPT_TOO_LONG. Image-to-image has no token cap.
export const PROMPT_MAX = 20000;
// Preserve the route-specific exports; all six model IDs share one limit.
export const MODE_PROMPT_MAX = PROMPT_MAX;
export const QUALITY_PROMPT_MAX = PROMPT_MAX;
export const FORMATS = new Set(["png", "jpeg", "webp"]);
export const MAX_IMAGES = 16;
export const POLL_INTERVAL_MS = 3000;
export const DEFAULT_TIMEOUT_MINUTES = 30;
// 2K/4K PNG outputs run to tens of MB; the 15s request timeout is too short.
export const DEFAULT_DOWNLOAD_TIMEOUT_MS = 120000;
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
export function normalizeModel(value) {
  const v = String(value).trim();
  if (Object.values(FAMILIES).includes(v))
    throw new Error(
      `"${v}" cannot be requested directly. Use ${v}/text-to-image or ${v}/image-to-image (default route), or ${v}@pro (--route pro) for quality tiers.`,
    );
  if (!ALL_MODEL_IDS.includes(v))
    throw new Error(
      `Unsupported model ID "${v}". Use one of: ${ALL_MODEL_IDS.join(", ")}.`,
    );
  return v;
}
export function isModeModel(model) {
  return Object.values(MODE_MODELS).includes(model);
}
export function isProModel(model) {
  return Object.values(PRO_MODELS).includes(model);
}
export function normalizeRoute(value = "mode") {
  const v = String(value).trim().toLowerCase();
  if (!ROUTES.has(v))
    throw new Error(`Unsupported route "${value}". Use mode or pro.`);
  return v;
}
export function normalizeFamily(value = "flare") {
  const v = String(value).trim().toLowerCase();
  if (!FAMILIES[v])
    throw new Error(`Unsupported family "${value}". Use flare or sunburst.`);
  return v;
}
// Picks the model ID: an explicit --model wins (and must agree with --route,
// --family, and the presence of reference images); otherwise --route and
// --family select it, defaulting to the family's mode model.
export function resolveModel(options = {}, hasImages = false) {
  const explicit = options.model || options.modelId;
  const mode = hasImages ? IMAGE_TO_IMAGE : TEXT_TO_IMAGE;
  const route = options.route == null ? null : normalizeRoute(options.route);
  if (!explicit) {
    const family = FAMILIES[normalizeFamily(options.family)];
    return route === "pro" ? `${family}@pro` : `${family}/${mode}`;
  }
  const model = normalizeModel(explicit);
  if (route && route !== (isProModel(model) ? "pro" : "mode"))
    throw new Error(`--route ${route} conflicts with --model ${model}.`);
  if (options.family && !model.startsWith(FAMILIES[normalizeFamily(options.family)]))
    throw new Error(`--family ${options.family} conflicts with --model ${model}.`);
  if (isModeModel(model) && !model.endsWith(`/${mode}`))
    throw new Error(
      hasImages
        ? `${model} does not accept image_urls; use the image-to-image model or omit --image-url.`
        : `${model} requires 1–16 image_urls; add --image-url or use the text-to-image model.`,
    );
  return model;
}
export function normalizeResolution(value) {
  const v = String(value ?? "1K")
    .trim()
    .toUpperCase();
  if (!RESOLUTIONS.has(v))
    throw new Error(
      `Unsupported resolution "${value}". Use one of: ${[...RESOLUTIONS].join(", ")}.`,
    );
  return v;
}
export function normalizeAspectRatio(value) {
  const v = String(value ?? "1:1").trim();
  if (!v) return "1:1";
  if (v.toLowerCase() === "auto")
    throw new Error(
      `Unsupported aspect ratio "auto". The @pro route has no auto size; use one of the 15 ratios (${[...ASPECT_RATIOS].join(", ")}) or a WxH pixel size such as 1152x1536.`,
    );
  if (ASPECT_RATIOS.has(v)) return v;
  const pixel = parsePixelSize(v);
  if (pixel.error) throw new Error(pixel.error);
  if (!pixel.ok)
    throw new Error(
      `Unsupported aspect ratio "${value}". Use one of: ${[...ASPECT_RATIOS].join(", ")}, or a WIDTHxHEIGHT pixel size (both sides multiples of 16, 16–3840, total pixels 655360–8294400, long side at most 3× the short side).`,
    );
  return v;
}
// Parses `WxH` with the backend's arithmetic limits. `ok` is false when the
// value is not a WxH pixel size the public schema accepts (each side is
// `[1-9][0-9]{1,3}` there: 2–4 digits, no leading zero); `error` is set when
// the shape matches but the arithmetic limits are violated (mirrors
// pixelSizeViolation in hiapi-backend).
export function parsePixelSize(value) {
  const v = String(value ?? "").trim();
  const parts = v.split("x");
  if (parts.length !== 2) return { ok: false };
  const side = /^[1-9][0-9]{1,3}$/;
  if (!side.test(parts[0]) || !side.test(parts[1])) return { ok: false };
  const w = Number(parts[0]);
  const h = Number(parts[1]);
  if (w > PRO_SIZE_EDGE_MAX || h > PRO_SIZE_EDGE_MAX)
    return {
      ok: true,
      error: "aspect_ratio width and height must not exceed 3840.",
    };
  if (w < PRO_SIZE_EDGE_MIN || h < PRO_SIZE_EDGE_MIN)
    return {
      ok: true,
      error: "aspect_ratio width and height must be at least 16.",
    };
  if (w % PRO_SIZE_EDGE_MULTIPLE !== 0 || h % PRO_SIZE_EDGE_MULTIPLE !== 0)
    return {
      ok: true,
      error: "aspect_ratio width and height must be multiples of 16.",
    };
  const pixels = w * h;
  if (pixels < PRO_SIZE_MIN_PIXELS || pixels > PRO_SIZE_MAX_PIXELS)
    return {
      ok: true,
      error: "aspect_ratio total pixels must be between 655360 and 8294400.",
    };
  if (w > h * PRO_SIZE_MAX_ASPECT || h > w * PRO_SIZE_MAX_ASPECT)
    return {
      ok: true,
      error: "aspect_ratio long side must be at most 3x the short side.",
    };
  return { ok: true, w, h };
}
function pixelTierFromPixels(pixels) {
  if (pixels <= PRO_TIER_MAX_PIXELS["1K"]) return "1K";
  if (pixels <= PRO_TIER_MAX_PIXELS["2K"]) return "2K";
  return "4K";
}
function ratioSides(value) {
  const [a, b] = value.split(":").map(Number);
  return a >= b ? [a, b] : [b, a];
}
// The tier actually billed for a ratio + --resolution pair: the upstream lays
// the ratio out within the tier's pixel budget but caps the long side at 3840,
// so 3:1 / 1:3 at 4K outputs 3840×1280 and is billed as 2K.
function ratioPixelTier(size, baseTier) {
  const [long, short] = ratioSides(size);
  if (!(long > 0 && short > 0)) return baseTier;
  const budget =
    PRO_TIER_MAX_PIXELS[baseTier] || PRO_TIER_MAX_PIXELS["1K"];
  let pixels = budget;
  if (budget * long > PRO_SIZE_EDGE_MAX * PRO_SIZE_EDGE_MAX * short)
    pixels = Math.floor(
      (PRO_SIZE_EDGE_MAX * PRO_SIZE_EDGE_MAX * short) / long,
    );
  return pixelTierFromPixels(pixels);
}
// Long side ÷ short side: < 1.3 square, ≤ 2 standard, otherwise panorama.
// Thresholds and the <= boundary match framingForSides in hiapi-backend
// service/modelparams/size_tier.go (7deadc914 / 62e164f24, origin/main).
export function computeFraming(size) {
  let w;
  let h;
  if (ASPECT_RATIOS.has(size)) [w, h] = ratioSides(size);
  else {
    const pixel = parsePixelSize(size);
    if (!pixel.ok || pixel.error) return "standard";
    w = pixel.w;
    h = pixel.h;
  }
  if (!(w > 0 && h > 0)) return "standard";
  const long = Math.max(w, h);
  const short = Math.min(w, h);
  const ratio = long / short;
  if (ratio < PRO_FRAMING_SQUARE_MAX) return "square";
  if (ratio <= PRO_FRAMING_STANDARD_MAX) return "standard";
  return "panorama";
}
// Pricing copy for the @pro route: the server prices on
// framing × resolution × quality, where resolution is the tier of the actual
// output pixels. Never sent upstream; used only to match /api/pricing rules.
export function proPricingInput(input = {}) {
  let size = String(input.aspect_ratio ?? "").trim();
  if (!ASPECT_RATIOS.has(size)) {
    const pixel = parsePixelSize(size);
    if (!pixel.ok || pixel.error) size = "1:1";
  }
  const declared = RESOLUTIONS.has(
    String(input.resolution ?? "").trim().toUpperCase(),
  )
    ? String(input.resolution).trim().toUpperCase()
    : "1K";
  let tier = declared;
  if (ASPECT_RATIOS.has(size)) tier = ratioPixelTier(size, declared);
  else {
    const pixel = parsePixelSize(size);
    if (pixel.ok && !pixel.error) tier = pixelTierFromPixels(pixel.w * pixel.h);
  }
  return {
    ...input,
    framing: computeFraming(size),
    resolution: tier,
  };
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
export function normalizeImageUrls(value, { allowDataUri = false } = {}) {
  if (Array.isArray(value) && value.length === 0)
    throw new Error(
      "image_urls must be omitted for text-to-image; an empty array is invalid.",
    );
  const urls = list(value);
  if (urls.length > MAX_IMAGES)
    throw new Error(`At most ${MAX_IMAGES} reference images are supported.`);
  for (const raw of urls) {
    if (allowDataUri && /^data:image\/(png|jpeg|jpg|webp);base64,/i.test(raw))
      continue;
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
  // Keep the existing trimmed JavaScript string.length (UTF-16) semantics.
  if (prompt.length > PROMPT_MAX)
    throw new Error(`prompt must be at most ${PROMPT_MAX} characters.`);
  const rawUrls = options.imageUrls ?? options.image_urls;
  const hasImages = Array.isArray(rawUrls) ? rawUrls.length > 0 : !!rawUrls;
  const model = resolveModel(options, hasImages);
  const outputFormat = options.outputFormat ?? options.output_format;
  // `framing` is a server-computed billing tier on the @pro routes (requests
  // that carry it return 400) and is not part of the mode schema at all.
  if (options.framing != null)
    throw new Error(
      "framing is a server-computed billing tier and must not be sent; the server derives it from aspect_ratio. Remove --framing.",
    );
  if (isModeModel(model)) {
    if (options.quality != null || outputFormat != null)
      throw new Error(
        `${model} is priced by resolution and does not accept quality or output_format; use --resolution, or --route pro for quality tiers.`,
      );
    const imageUrls = normalizeImageUrls(rawUrls, { allowDataUri: true });
    const resolution = normalizeResolution(options.resolution);
    const input = { prompt };
    if (imageUrls.length) input.image_urls = imageUrls;
    input.aspect_ratio = enumValue(
      options.aspectRatio ?? options.aspect_ratio,
      "auto",
      MODE_ASPECT_RATIOS,
      "aspect ratio",
    );
    input.resolution = resolution;
    if (options.background != null) {
      input.background = normalizeBackground(options.background);
      if (resolution !== "1K")
        throw new Error(
          "background is supported only at resolution 1K; omit --background for 2K/4K.",
        );
    }
    return { model, input };
  }
  const imageUrls = normalizeImageUrls(rawUrls);
  const background = normalizeBackground(options.background);
  const format = normalizeOutputFormat(outputFormat);
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
    resolution: normalizeResolution(options.resolution),
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
    options.downloadTimeoutMs || DEFAULT_DOWNLOAD_TIMEOUT_MS,
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
  // Every supported route is listed in public pricing under its exact ID.
  const pricingNames = [payload.model];
  const row = body?.data?.find((entry) => pricingNames.includes(entry?.model_name));
  if (!row)
    throw new Error(`Current public pricing does not list ${payload.model} (checked ${pricingNames.join(", ")}).`);
  // @pro rows are fixed rules over {framing, resolution, quality}; framing is
  // computed by the server and resolution is the tier of the actual output
  // pixels, so match against a local pricing copy, not the request body.
  const pricingInput = isProModel(payload.model)
    ? proPricingInput(payload.input)
    : payload.input;
  const policy = (row.policies || []).find((p) =>
    Object.entries(p.rule || {}).every(
      ([k, v]) => pricingInput[k] === v.match,
    ),
  );
  const unitUsd = Number(policy?.usd_value ?? row.base_usd_value);
  return {
    model: payload.model,
    pricingModel: row.model_name,
    unitUsd,
    estimatedUsd: Number.isFinite(unitUsd) ? Number(unitUsd.toFixed(4)) : null,
    billingBasis:
      row.base_display_unit?.en || "current public pricing snapshot",
    ...(isProModel(payload.model)
      ? {
          pricingRule: {
            framing: pricingInput.framing,
            resolution: pricingInput.resolution,
            quality: pricingInput.quality,
          },
          matchedPolicy: policy?.name || null,
        }
      : { matchedPolicy: policy?.name || null }),
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
  for (const model of Object.values(PRO_MODELS)) {
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
      "resolution",
      "background",
      "output_format",
      "framing",
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
      props.prompt?.maxLength === PROMPT_MAX &&
      // Production publishes the @pro size as a pattern (15 ratios + WxH),
      // not an enum, and no longer accepts `auto`.
      props.aspect_ratio?.pattern === PRO_ASPECT_RATIO_PATTERN &&
      props.aspect_ratio?.enum === undefined &&
      props.aspect_ratio?.default === "1:1" &&
      enumMatches("quality", [...QUALITIES]) &&
      props.quality?.default === "medium" &&
      enumMatches("resolution", [...RESOLUTIONS]) &&
      props.resolution?.default === "1K" &&
      enumMatches("background", [...BACKGROUNDS]) &&
      props.background?.default === "auto" &&
      enumMatches("output_format", [...FORMATS]) &&
      props.output_format?.default === "webp" &&
      // framing is server-computed and must stay hidden from clients.
      enumMatches("framing", [...FRAMINGS]) &&
      props.framing?.default === "standard" &&
      props.framing?.visible === false &&
      props.framing?.["x-hiapi-server-computed"] === true;
    checks.push({
      model,
      ok,
      wrapperModelProperty: wrapper,
      required: schema?.required || [],
      properties: Object.keys(props),
      imageUrlsMax: props.image_urls?.maxItems,
      promptMinLength: props.prompt?.minLength,
      promptMaxLength: props.prompt?.maxLength,
      expectedPromptMaxLength: PROMPT_MAX,
      aspectRatioPattern: props.aspect_ratio?.pattern ?? null,
    });
  }
  for (const model of Object.values(MODE_MODELS)) {
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
    const i2i = model.endsWith(`/${IMAGE_TO_IMAGE}`);
    const sorted = (values) => JSON.stringify([...(values || [])].sort());
    const expectedProps = [
      "aspect_ratio",
      "background",
      "model",
      "prompt",
      "resolution",
      ...(i2i ? ["image_urls"] : []),
    ];
    const ok =
      !!schema &&
      !!props.model?.enum?.includes(model) &&
      sorted(Object.keys(props)) === sorted(expectedProps) &&
      sorted(schema.required) ===
        sorted(["model", "prompt", ...(i2i ? ["image_urls"] : [])]) &&
      props.prompt?.minLength === 1 &&
      props.prompt?.maxLength === PROMPT_MAX &&
      JSON.stringify(props.aspect_ratio?.enum) ===
        JSON.stringify([...MODE_ASPECT_RATIOS]) &&
      props.aspect_ratio?.default === "auto" &&
      JSON.stringify(props.resolution?.enum) ===
        JSON.stringify([...RESOLUTIONS]) &&
      props.resolution?.default === "1K" &&
      sorted(props.background?.enum) === sorted([...BACKGROUNDS]) &&
      props.background?.default === undefined &&
      (!i2i ||
        (props.image_urls?.minItems === 1 &&
          props.image_urls?.maxItems === MAX_IMAGES));
    checks.push({
      model,
      ok,
      wrapperModelProperty: !!props.model?.enum?.includes(model),
      required: schema?.required || [],
      properties: Object.keys(props),
      imageUrlsMax: props.image_urls?.maxItems,
      promptMinLength: props.prompt?.minLength,
      promptMaxLength: props.prompt?.maxLength,
      expectedPromptMaxLength: PROMPT_MAX,
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
    "--family": "family",
    "--route": "route",
    "--resolution": "resolution",
    "--aspect-ratio": "aspectRatio",
    "--aspect": "aspectRatio",
    "--quality": "quality",
    "--framing": "framing",
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
  return `HiAPI GPT Image 2.5 skill

Default route (mode): without --image-url the CLI uses gpt-image-2.5-<family>/text-to-image; with --image-url it uses gpt-image-2.5-<family>/image-to-image. Family defaults to flare. --route pro uses gpt-image-2.5-<family>@pro (priced by framing × resolution × quality). The bare IDs gpt-image-2.5-flare / gpt-image-2.5-sunburst are not accepted.

Preflight: node scripts/hiapi-gpt-image-2-5.mjs --prompt "..." --dry-run --estimate
Create: node scripts/hiapi-gpt-image-2-5.mjs --prompt "..." --resolution 2K
Edit: node scripts/hiapi-gpt-image-2-5.mjs --prompt "..." --image-url <url>
Recover: node scripts/hiapi-gpt-image-2-5.mjs --resume-task-id <task-id>

Mode route options: --family <flare|sunburst>, --image-url <url|data URI> (repeatable, max 16), --aspect-ratio <auto|1:1|3:2|2:3|4:3|3:4|16:9|9:16|21:9|27:16|16:27|9:8|8:9>, --resolution <1K|2K|4K>, --background <auto|transparent|opaque> (1K only)
Pro route: --route pro [--family <flare|sunburst>] or --model <gpt-image-2.5-flare@pro|gpt-image-2.5-sunburst@pro>, --image-url <url>, --aspect-ratio <ratio (15 values) or WxH pixel size> (default 1:1, no auto), --resolution <1K|2K|4K> (default 1K), --quality <low|medium|high|xhigh|max> (default medium, no auto), --background <auto|transparent|opaque>, --output-format <png|jpeg|webp>
framing is computed by the server and is never sent; --framing is rejected locally.
Prompt: --prompt <text> is required for new tasks; 1–${PROMPT_MAX} UTF-16 code units after trimming surrounding whitespace (all routes).
Common: --model <exact ID>, --dry-run, --estimate, --no-wait, --no-save, --idempotency-key <key>, --resume-task-id <id>, --output-dir <dir>, --timeout-minutes <n>`;
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
