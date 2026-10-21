---
name: Ayatrisya model ownership
description: Ayatrisya must use its own operated AI models and not third-party company inference APIs.
---

Ayatrisya AI inference and media generation must use Ayatrisya-operated models or a user-controlled local runtime. Do not call another company's AI API.

**Why:** The user explicitly said, "don't use any other company api make own."

**How to apply:** Keep inference routes limited to Ayatrisya-owned services or desktop loopback adapters. Be clear that integration code is not itself a trained model or deployed inference runtime.
