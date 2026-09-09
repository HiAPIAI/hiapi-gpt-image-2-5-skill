# Agent installation

Requires Node.js 18 or newer. Every install must name its destination explicitly; the installer does not guess a client-wide directory and does not modify global state.

From a local checkout:

```bash
node scripts/install.mjs --target=/path/to/skills
node scripts/install.mjs --target=/path/to/skills --force
```

The target must be an empty directory for a first install. `--force` is for replacing an existing copy of this same skill after checking its identity. Client layout shortcuts are available when the target is already the intended root: `--codex` and `--claude`; they still require an explicit `--target` in this release candidate.

For the eventual GitHub package, use the explicit binary because this repository exposes more than one bin:

```bash
npx --yes --package=github:HiAPIAI/hiapi-gpt-image-2-5-skill hiapi-gpt-image-2-5-install --target="${AGENT_SKILLS_DIR:?Set AGENT_SKILLS_DIR}"
npx --yes --package=github:HiAPIAI/hiapi-gpt-image-2-5-skill hiapi-gpt-image-2-5-install --target="${AGENT_SKILLS_DIR:?Set AGENT_SKILLS_DIR}" --force
```

After installation, run `node scripts/check-config.mjs` and inspect `node scripts/hiapi-gpt-image-2-5.mjs --help`. Set `HIAPI_API_KEY` only when creating or recovering a task. Update policy is soft/hard gated: a stale but supported copy may warn; a below-minimum copy blocks new paid creation while allowing preflight and recovery. See [references/upgrade-policy.md](references/upgrade-policy.md).
