---
name: Ayatrisya account access
description: Product authentication policy and handling for older browser-local content.
---

Ayatrisya supports Firebase email/password, Google, and GitHub accounts, plus an opt-in browser-local guest mode. Guests may use unlimited chats and the two-image allowance only; all other workspace features require an account. Guest chats stay under the `"guest"` owner and are not silently uploaded or moved into a new account.

**Why:** The user requested guest access limited to unlimited chat and two image generations, with no other workspace features, and later requested GitHub login. The current app does not yet have a connected image-generation model.

**How to apply:** Keep guest routes limited to chat and the image-generation status page. Keep account-only routes behind Firebase authentication. Preserve guest records locally and require explicit confirmation before copying them into an account.
