---
name: Ayatrisya hosted model gateway
description: Security and readiness requirements for Ayatrisya-operated remote model inference.
---
Ayatrisya's cross-platform routing requirement is: browser and mobile web use the authenticated hosted gateway; the desktop app uses same-computer local inference by default and must never silently fall back to hosted inference. A desktop cloud option, if added later, must require explicit opt-in and a privacy disclosure. Keep the desktop bridge loopback-only; do not use a LAN HTTP address or make an unauthenticated local model port public. The bridge does not send an API key. Hosted inference requires a public Ayatrisya-operated HTTPS endpoint, Firebase verification on every request, a server-only key in Replit Secrets, per-user limits, and timeouts.

Health and capability responses alone must not be presented as proof that a model works; require a successful live inference test. Never place model credentials in browser code or a populated `.env` file.

**Why:** The user specified authenticated cloud inference for browser/mobile clients while retaining local-first inference and no silent cloud fallback on desktop.

**How to apply:** Configure a same-computer service through the verified desktop bridge and confirm a live response there. Do not claim hosted inference is connected unless its separate HTTPS endpoint and server-side secret are configured and a real inference succeeds.

The Ametesx-owned Ayatrisya model is still under development. Do not invent an endpoint or report the model as available; keep the client compatible for a later verified integration.

**Why:** The user confirmed model development is still in progress and explicitly prohibited fabricated endpoints or availability claims.

**How to apply:** Keep model capability unavailable until the owner supplies a real endpoint and it passes a live inference test.
