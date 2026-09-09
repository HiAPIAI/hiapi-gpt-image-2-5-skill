# Upgrade policy

The runtime checks the central directory first and repository policy second. Below `minimumVersion` blocks new paid creation; below `latestVersion` emits a notice and continues. If update sources are unavailable, the version is unverified but local validation still permits new creation; recovery and non-billing preflight remain usable. An update-service outage does not become a generation outage.
