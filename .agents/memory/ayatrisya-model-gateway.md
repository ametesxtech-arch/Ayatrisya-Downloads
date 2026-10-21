---
name: Ayatrisya hosted model gateway
description: Security and readiness requirements for Ayatrisya-operated remote model inference.
---
Hosted model access is for Firebase-authenticated accounts only. Verify Firebase identity on the API server for each request, keep the model API key server-side in Replit Secrets, apply per-user limits and timeouts, and keep desktop localhost inference on its separate transport. Health or capability responses alone must not be presented as proof that a model works; require a successful live inference test.

**Why:** The user explicitly chose authenticated-only access to the shared hosted endpoint and required credential isolation, request controls, separate local inference, and truthful readiness reporting.

**How to apply:** Use the Ayatrisya API server as the hosted model gateway; never put model credentials in `VITE_` variables, browser storage, source, or logs. Do not describe models as connected until real generation returns a non-empty response.
