---
name: Ayatrisya account access
description: Product authentication policy and handling for older browser-local content.
---

Ayatrisya requires an authenticated Firebase account; supported entry methods are email/password and Google. Do not expose a guest workspace. Older browser-local records from previous guest-mode versions may be imported only through a clear, user-confirmed action after sign-in; do not delete or upload them automatically.

**Why:** The user stated that Ayatrisya will have no guest mode and specified email/password accounts plus Google login.

**How to apply:** Gate workspace and onboarding routes on an active Firebase user. Preserve legacy records separately and only copy them into an account after explicit user confirmation.
