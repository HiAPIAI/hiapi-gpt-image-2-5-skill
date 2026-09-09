# SEO and discoverability readiness

This checklist improves relevance and installation clarity; it does not guarantee crawling, indexing, directory inclusion, ranking, or client compatibility. The public repository and its release metadata are configured; search indexing and directory listing remain unverified.

## Completed locally

- The unique H1 and opening paragraphs naturally identify a **HiAPI GPT Image 2.5 Agent Skill** for AI image generation and editing, with exact Flare/Sunburst IDs and Codex/Claude Code context.
- Both READMEs expose user scenarios, supported dimensions/options, 1–16 reference images, installation, recovery, local-image limits, pricing/key boundaries, transparency, and FAQ answers without claiming full client testing.
- `package.json` has exact repository metadata and focused keywords; `private: true` remains, so this package is not presented as an npm publication.
- `llms.txt` is a small navigation index for agents. It is not an SEO or `skills.sh` inclusion guarantee.
- The official Skills CLI was locally run with telemetry disabled against this checkout and listed one exact skill match; listing is discovery evidence only, not installation, publication, or directory ranking evidence.
- `.github/repository-metadata.json` is a release-time intent file for GitHub description, homepage, topics, and social preview. It does not change GitHub settings automatically. Topics are lowercase, hyphenated, and within the 20-topic/50-character limits. The metadata points to `assets/github-social-preview.jpg`, a same-size JPEG derived from the README PNG for GitHub's social-preview upload size budget; the READMEs intentionally continue to reference the PNG.

## Verified after publication

- GitHub About description, homepage, and 11 repository topics were configured through the GitHub API.
- The GitHub social preview was uploaded and visually confirmed in repository Settings. The public `og:image` is `https://repository-images.githubusercontent.com/1362432407/9a6e6462-63cf-4e72-975f-e68dac873da1`.
- The official Agent Skills CLI command `npx --yes skills add HiAPIAI/hiapi-gpt-image-2-5-skill --skill hiapi-gpt-image-2-5 --agent codex --copy --yes` installed the exact skill successfully into a clean temporary project. After installation, Flare `--dry-run --estimate` returned `paidTaskCreated:false` and a current medium estimate of `$0.0672`.
- No global skill installation and no paid task were performed during this acceptance. Client runtime acceptance beyond the recorded Codex installation remains separate.

## Release-time actions

1. Verify raw README, `SKILL.md`, `llms.txt`, asset URLs, default branch, and any directory submission/telemetry separately.
2. Test supported Agent Skills clients individually; do not convert documentation into client acceptance.
3. Keep model availability, skill publication, directory inclusion, crawling/indexing, and ranking as separate states. `skills.sh` listing and Google indexing have not been verified.
4. The central `hiapi-skills` and `awesome-gpt-image-2-prompts` updates are represented by open PRs and are not claimed as merged or exposed on their default branches.

## Source notes

- [Scenario skills](https://github.com/scenario-labs/skills) informed putting concrete scenarios and installation near the top of a skill repository. It is a content/layout reference, not evidence that this repository is listed there.
- [Vercel agent-skills](https://github.com/vercel-labs/agent-skills) informed explicit “Use when” style invocation boundaries and task-oriented skill descriptions. It does not establish this package's client compatibility.
- [skills.sh FAQ](https://www.skills.sh/docs/faq) documents that directory participation depends on real installation telemetry; writing a README alone does not establish inclusion.
- [GitHub Topics documentation](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/classifying-your-repository-with-topics) supports using accurate, lowercase hyphenated topics for repository discovery. Topics still do not guarantee traffic or ranking.
- [Google Search documentation](https://developers.google.com/search/docs/fundamentals/how-search-works) separates crawling, indexing, and serving/ranking. Metadata can improve relevance and understanding, but cannot guarantee search visibility or position.
- [GitHub social preview documentation](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/customizing-your-repositorys-social-media-preview) is the source for treating the JPEG as a release-time upload asset; the local file does not configure GitHub.
