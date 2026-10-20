---
name: Browser data verification boundaries
description: Why local persistence checks must retain a browser context and avoid the creator's data.
---
Ayatrisya's save/reload/export/restore verification must stay within one isolated
browser profile. A screenshot from a different browser session is not evidence
that previously created local records were lost or retained.

For browser assertions, normalize `innerText` because CSS text transforms affect
its casing. A shell-level selector is not enough to prove a lazy route has
loaded; wait for route-specific controls. For reload checks, distinguish the
new document from the old DOM before checking persisted content.

**Why:** Content is intentionally browser-local. Screenshot capture, automation
and the creator's preview do not share an IndexedDB profile, and replacement
restore is destructive within its current profile. Shared shell UI and the
pre-reload DOM can make an incomplete check pass too early.

**How to apply:** Create test content in a clean profile and keep that profile
for the entire lifecycle check. Wait for the reload to replace the document,
then wait for route-specific content before interacting. Never run destructive
test imports against the creator's existing browser data, and distinguish unit,
browser and live-service evidence in delivery reports.
