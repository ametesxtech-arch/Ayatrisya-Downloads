# Ayatrisya model gateway

Hosted model requests go through the Ayatrisya API server. The browser never receives the model API key. Desktop localhost inference is a separate transport and does not use these server credentials.

## Desktop-only local inference

The current model connection choice is desktop-only on the same computer. In Ayatrisya Desktop, open **Settings → Models → Desktop-only local model** and set the endpoint to a loopback URL such as `http://127.0.0.1:1234` or `http://localhost:1234`. Saving it runs a health, capabilities, and live-inference check.

- The desktop bridge accepts only `localhost`, `127.0.0.1`, and `::1` loopback endpoints. HTTP is allowed on loopback; LAN/private IP addresses and public hosts are rejected.
- The bridge sends no API key. The local model service must be available on the same computer and accept the app's model API requests without a bearer key.
- The bridge validates permitted routes and request bodies, applies a timeout and response-size limit, and uses context-isolated IPC. It does not expose Node.js, filesystem, or shell access to the renderer.
- A local/private service on a different computer is not supported by this connection. Do not enter a LAN address or expose an unauthenticated model port to the internet.
- The website cannot reach localhost on the user's computer. Hosted web inference requires the separate authenticated HTTPS gateway described below.

## Configure securely

- Set `AYATRISYA_MODEL_ENDPOINT` as a shared, non-secret Replit environment variable. It must be an HTTPS base URL for an Ayatrisya-operated service, with no embedded credentials, query, or fragment.
- Add `AYATRISYA_MODEL_API_KEY` through Replit Secrets. The gateway sends it upstream as `Authorization: Bearer <key>`.
- Do not put a real key in `.env`, `.env.example`, a `VITE_` variable, source code, or logs.
- Set `FIREBASE_PROJECT_ID` on the API server. Every hosted model request must include a valid Firebase ID token; guests cannot call the hosted model.

The previous public `VITE_AYATRISYA_ENDPOINT` client setting is not used for hosted requests. Do not put the model key in a browser-visible setting.

## Model service contract

The configured base URL must implement these paths:

| Method and path | Request / response |
| --- | --- |
| `GET /health` | `{"status":"ok"}` |
| `GET /capabilities` | `{"models":[{"id":"v1-fast","available":true,"streaming":false,"modalities":["chat"]}]}`. Model IDs are `v1-fast` and `v2-best`. |
| `POST /chat` | JSON `{messages, model, mode, stream}`. Return `{"text":"..."}` or newline-delimited / SSE token objects. |
| `POST /generate/image` | JSON prompt/model/format and image size; return `{fileName,mimeType,dataBase64}`. Formats: PNG or JPEG. |
| `POST /generate/3d` | JSON prompt/model/format; return `{fileName,mimeType,dataBase64}`. Format: GLB. |
| `POST /generate/music` | JSON prompt/model/format/duration; return `{fileName,mimeType,dataBase64}`. Formats: WAV or MP3. |
| `POST /transcribe` | Multipart form with an `audio` part; return `{"text":"..."}`. |
| `POST /speech` | JSON `{"text":"..."}`; return WAV or MPEG audio. |

The upstream must accept the API key as a bearer token. Redirects are rejected. Known third-party inference hosts, local/IP URLs, non-HTTPS URLs, and URLs containing credentials are rejected.

## Access and safety

- Firebase ID tokens are verified server-side on every hosted model request.
- Per verified user, the API allows up to 60 requests per minute and up to 10 generation, transcription, or speech requests per minute. These limits are in-memory per API process.
- Upstream requests time out after 120 seconds. Request bodies, generated responses, and audio uploads have explicit size limits.
- The gateway returns generic upstream failures; it does not return provider response bodies or log prompts, tokens, or model keys.
- Capability and health responses are informational, not proof that generation works. In **Settings → Models**, run **Live inference test** to send an unsaved test prompt. The UI reports success only after a non-empty model response.

## Verification status

Automated tests cover Firebase identity checks, server-only key forwarding, invalid input rejection, capability/health validation, streaming chat, per-user generation limits, and redaction of upstream errors. Live inference is not verified until a valid endpoint and key are configured and the Settings test succeeds.
