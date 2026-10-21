---
name: Ayatrisya hosted model gateway
description: Security and readiness requirements for Ayatrisya-operated remote model inference.
---
The user chose desktop-only local inference on the same computer for the current model connection. Keep this on the existing loopback-only desktop bridge; do not use a LAN HTTP address or make an unauthenticated local model port public. The bridge does not send an API key. Hosted inference remains a separate option requiring a public Ayatrisya-operated HTTPS endpoint, Firebase verification on every request, a server-only key in Replit Secrets, per-user limits, and timeouts.

Health and capability responses alone must not be presented as proof that a model works; require a successful live inference test. Never place model credentials in browser code or a populated `.env` file.

**Why:** The user selected the same-computer desktop route after confirming their available service is only local/private HTTP; hosted access had also been specified as authenticated-only.

**How to apply:** For this local service, configure a loopback URL in Ayatrisya Desktop and confirm a live response there. Do not claim the website's hosted model is connected unless its separate HTTPS endpoint and secret are configured and a real inference succeeds.
