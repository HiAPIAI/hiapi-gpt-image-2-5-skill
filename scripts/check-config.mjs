#!/usr/bin/env node
import { checkLiveContract } from "./lib/gpt-image-2-5.mjs";
const result = await checkLiveContract();
console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exitCode = 2;
