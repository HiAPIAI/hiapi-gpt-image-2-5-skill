#!/usr/bin/env node
import {
  buildImagePayload,
  checkLiveContract,
  fetchPricingEstimate,
  generateImage,
  redactPayload,
  resolveConfig,
  usage,
  warnOrRequireSkillUpdate,
  parseArgs,
} from "./lib/gpt-image-2-5.mjs";
async function main() {
  const o = parseArgs(process.argv.slice(2));
  if (o.help) {
    console.log(usage());
    return;
  }
  if (o.checkContract) {
    const r = await checkLiveContract();
    console.log(JSON.stringify(r, null, 2));
    if (!r.ok) process.exitCode = 2;
    return;
  }
  if (o.dryRun || o.estimate) {
    await warnOrRequireSkillUpdate({ allowRecovery: true });
    const payload = buildImagePayload(o);
    const estimate = o.estimate ? await fetchPricingEstimate(payload) : null;
    console.log(
      JSON.stringify(
        {
          ok: true,
          paidTaskCreated: false,
          payload: redactPayload(payload),
          estimate,
          next: "Review the payload and estimate, then remove --dry-run and --estimate to create the paid task.",
        },
        null,
        2,
      ),
    );
    return;
  }
  console.log(JSON.stringify(await generateImage(o, resolveConfig()), null, 2));
}
main().catch((e) => {
  console.error(e?.message || String(e));
  process.exitCode = 1;
});
