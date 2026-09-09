# SEO and discoverability readiness

This checklist improves relevance and installation clarity; it does not guarantee crawling, indexing, directory inclusion, ranking, or client compatibility. The GitHub repository has not been created, this checkout has no remote, and the package has not been publicly installed or listed.

## Completed locally

- The unique H1 and opening paragraphs naturally identify a **HiAPI GPT Image 2.5 Agent Skill** for AI image generation and editing, with exact Flare/Sunburst IDs and Codex/Claude Code context.
- Both READMEs expose user scenarios, supported dimensions/options, 1–16 reference images, installation, recovery, local-image limits, pricing/key boundaries, transparency, and FAQ answers without claiming full client testing.
- `package.json` has exact repository metadata and focused keywords; `private: true` remains, so this package is not presented as an npm publication.
- `llms.txt` is a small navigation index for agents. It is not an SEO or `skills.sh` inclusion guarantee.
- The official Skills CLI was locally run with telemetry disabled against this checkout and listed one exact skill match; listing is discovery evidence only, not installation, publication, or directory ranking evidence.
- `.github/repository-metadata.json` is a release-time intent file for GitHub description, homepage, topics, and social preview. It does not change GitHub settings automatically. Topics are lowercase, hyphenated, and within the 20-topic/50-character limits. The metadata points to `assets/github-social-preview.jpg`, a same-size JPEG derived from the README PNG for GitHub's social-preview upload size budget; the READMEs intentionally continue to reference the PNG.

## Release-time actions

1. Create the intended GitHub repository and apply the metadata file manually or through an authorized release workflow; verify the About description, homepage, topics, and social preview. A local README image link or metadata intent file does not prove that GitHub has uploaded/configured the social preview.
2. Publish the repository before advertising `npx skills add HiAPIAI/hiapi-gpt-image-2-5-skill --skill hiapi-gpt-image-2-5`. Then run that command through the official Agent Skills CLI and record install evidence.
3. Verify raw README, `SKILL.md`, `llms.txt`, asset URLs, default branch, and any directory submission/telemetry separately. Test supported Agent Skills clients individually; do not convert documentation into client acceptance.
4. Keep model availability, skill publication, directory inclusion, crawling/indexing, and ranking as separate states.

## Source notes

- [Scenario skills](https://github.com/scenario-labs/skills) informed putting concrete scenarios and installation near the top of a skill repository. It is a content/layout reference, not evidence that this repository is listed there.
- [Vercel agent-skills](https://github.com/vercel-labs/agent-skills) informed explicit “Use when” style invocation boundaries and task-oriented skill descriptions. It does not establish this package's client compatibility.
- [skills.sh FAQ](https://www.skills.sh/docs/faq) documents that directory participation depends on real installation telemetry; writing a README alone does not establish inclusion.
- [GitHub Topics documentation](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/classifying-your-repository-with-topics) supports using accurate, lowercase hyphenated topics for repository discovery. Topics still do not guarantee traffic or ranking.
- [Google Search documentation](https://developers.google.com/search/docs/fundamentals/how-search-works) separates crawling, indexing, and serving/ranking. Metadata can improve relevance and understanding, but cannot guarantee search visibility or position.
- [GitHub social preview documentation](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/customizing-your-repositorys-social-media-preview) is the source for treating the JPEG as a release-time upload asset; the local file does not configure GitHub.
