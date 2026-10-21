---
name: Ayatrisya preview delivery
description: Ensure visual fixes reach the current Ayatrisya preview rather than an old browser host.
---
When fixing visible Ayatrisya UI issues, verify the active managed preview and present that existing artifact after changes. If the user's screenshot or browser appears to use a different preview host, state that code changes will not update the old host and direct them to the active preview.

**Why:** A previous logo/background fix did not appear to change the page because the user's browser was on a different preview host from the current running artifact.

**How to apply:** Before closing a visual fix, compare the preview shown by the active artifact to the reported screenshot, verify key asset and CSS behavior, and surface the active preview. Clearly distinguish preview verification from checking a published domain or an authenticated page.
