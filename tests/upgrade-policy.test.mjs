import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import {
  checkSkillUpdate,
  SKILL_VERSION,
  warnOrRequireSkillUpdate,
} from "../scripts/lib/gpt-image-2-5.mjs";

const readJson = async (file) => JSON.parse(await readFile(new URL(file, import.meta.url), "utf8"));
const policy = await readJson("../update-policy.json");
const central = { skills: [policy] };
const response = (body) => new Response(JSON.stringify(body));

test("0.3.1 hard-upgrade metadata agrees across package, runtime, and manifest", async () => {
  assert.equal((await readJson("../package.json")).version, "0.3.1");
  assert.equal((await readJson("../.hiapi-skill-release.json")).version, "0.3.1");
  assert.equal(SKILL_VERSION, "0.3.1");
  assert.equal(policy.version, "0.3.1");
  assert.equal(policy.updatePolicy.latestVersion, "0.3.1");
  assert.equal(policy.updatePolicy.minimumVersion, "0.3.1");
});

test("published policy requires 0.3.0 to upgrade and accepts 0.3.1", async () => {
  const fetchImpl = async () => response(central);
  const old = await checkSkillUpdate({ currentVersion: "0.3.0", fetchImpl });
  assert.equal(old.status, "required");
  assert.equal(old.minimumVersion, "0.3.1");
  assert.match(old.message, /8,000-character/);
  assert.equal((await checkSkillUpdate({ currentVersion: "0.3.1", fetchImpl })).status, "current");
  await assert.rejects(warnOrRequireSkillUpdate({ currentVersion: "0.3.0", fetchImpl }), /Update to 0.3.1/);
  assert.equal((await warnOrRequireSkillUpdate({ currentVersion: "0.3.0", fetchImpl, allowRecovery: true })).status, "required");
});

test("central hard policy takes precedence over a stale repository fallback", async () => {
  let calls = 0;
  const result = await checkSkillUpdate({
    currentVersion: "0.3.0",
    fetchImpl: async () => {
      calls += 1;
      return response(calls === 1 ? central : {
        ...policy, updatePolicy: { latestVersion: "0.3.0", minimumVersion: "0.3.0" },
      });
    },
  });
  assert.equal(result.status, "required");
  assert.equal(calls, 1);
});

test("repository hard policy is used if central is unavailable", async () => {
  let calls = 0;
  const result = await checkSkillUpdate({
    currentVersion: "0.3.0",
    fetchImpl: async () => {
      calls += 1;
      return calls === 1 ? new Response("unavailable", { status: 503 }) : response(policy);
    },
  });
  assert.equal(result.status, "required");
  assert.equal(calls, 2);
});
