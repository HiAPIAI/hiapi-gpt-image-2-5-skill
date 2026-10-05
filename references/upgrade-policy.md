# Upgrade policy

The runtime checks the central directory first and repository policy second. Below `minimumVersion` blocks new paid creation; below `latestVersion` emits a notice and continues. If update sources are unavailable, the version is unverified but local validation still permits new creation; recovery and non-billing preflight remain usable. An update-service outage does not become a generation outage.

Version 0.3.1 is a hard upgrade: both `latestVersion` and `minimumVersion` are `0.3.1`, because older copies allow prompts beyond the current 8,000-character schema limit. Publish the installable Skill version before raising the central minimum. The central `hiapi-skills` entry and this repository policy must agree; a successful central lookup takes precedence over the repository fallback. Preflight and recovery remain available to older copies.
