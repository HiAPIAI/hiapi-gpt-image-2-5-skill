#!/usr/bin/env node
import { cp, lstat, mkdir, readdir, readFile } from "node:fs/promises";
import { join, dirname, resolve, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
const args = process.argv.slice(2);
const val = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0
    ? args[i + 1]
    : args.find((x) => x.startsWith(`--${name}=`))?.slice(name.length + 3);
};
const requestedTarget = val("target") || val("skills-dir");
const target = requestedTarget
  ? resolve(requestedTarget)
  : args.includes("--codex")
    ? resolve(
        process.env.CODEX_HOME || join(process.env.HOME || "/tmp", ".codex"),
        "skills",
      )
    : args.includes("--claude")
      ? resolve(process.env.HOME || "/tmp", ".claude", "skills")
      : null;
if (!target)
  throw new Error(
    "Specify --target <empty-dir>, --codex, or --claude; the installer never defaults to the current directory.",
  );
const force = args.includes("--force");
const source = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const destination = join(target, "hiapi-gpt-image-2-5");
if (destination === source || destination.startsWith(`${source}/`))
  throw new Error(
    "Installation target cannot be inside the source skill directory.",
  );
if ((await lstat(target).catch(() => null))?.isSymbolicLink())
  throw new Error("Installation target must not be a symlink.");
if ((await lstat(destination).catch(() => null))?.isSymbolicLink())
  throw new Error("Installation destination must not be a symlink.");
await mkdir(target, { recursive: true });
let existing = [];
try {
  existing = await readdir(destination);
} catch {}
if (existing.length && !force)
  throw new Error(
    `Refusing to replace non-empty target ${destination}; use --force only for a verified same-skill replacement.`,
  );
if (existing.length && force) {
  const currentSkill = await readFile(
    join(destination, "SKILL.md"),
    "utf8",
  ).catch(() => "");
  if (!currentSkill.includes("name: hiapi-gpt-image-2-5")) {
    throw new Error(
      "--force is allowed only when the destination is the same verified hiapi-gpt-image-2-5 skill.",
    );
  }
}
await cp(source, destination, {
  recursive: true,
  force,
  filter: (src) => {
    const parts = relative(source, src).split(sep);
    return !parts.some(
      (part) =>
        part === ".git" ||
        part === "node_modules" ||
        part === "outputs" ||
        part === ".env" ||
        (part.startsWith(".env.") && part !== ".env.example"),
    );
  },
});
console.log(`Installed local HiAPI GPT Image 2.5 skill to ${destination}`);
