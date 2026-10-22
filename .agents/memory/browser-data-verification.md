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

Authenticated end-to-end tests must reuse the configured test account and follow
the normal sign-in and onboarding screens. Firebase signup persists an account
and requests email verification; it is not a disposable browser-only operation.
Temporary Chromium profiles can retain auth sessions, so redact page content
from failure diagnostics and remove the profile after each run.

**Why:** Content is intentionally browser-local. Screenshot capture, automation
and the creator's preview do not share an IndexedDB profile, and replacement
restore is destructive within its current profile. Shared shell UI and the
pre-reload DOM can make an incomplete check pass too early. A real Firebase
signup also has lasting account and verification-email side effects, while an
uncleaned browser profile can retain its session.

**How to apply:** Create test content in a clean profile and keep that profile
for the entire lifecycle check. Wait for the reload to replace the document,
then wait for route-specific content before interacting. Never run destructive
test imports against the creator's existing browser data, and distinguish unit,
browser and live-service evidence in delivery reports. Reuse the configured
test account, do not bypass onboarding or verification, and clean up its
temporary browser profile without printing credentials or account page content.
