---
name: Browser data verification boundaries
description: Why local persistence checks must retain a browser context and avoid the creator's data.
---
Ayatrisya's save/reload/export/restore verification must stay within one isolated
browser profile. A screenshot from a different browser session is not evidence
that previously created local records were lost or retained.

**Why:** Content is intentionally browser-local. Screenshot capture, automation
and the creator's preview do not share an IndexedDB profile, and replacement
restore is destructive within its current profile.

**How to apply:** Create test content in a clean profile and keep that profile
for the entire lifecycle check. Never run destructive test imports against the
creator's existing browser data, and distinguish unit, browser and live-service
evidence in delivery reports.
