# Ayatrisya Initial Audience Validation

## Provisional decision

- **Audience:** students, learners, and independent creators.
- **First use cases:** AI-assisted study, writing, and coding.
- This is a hypothesis, not validated positioning. Do not claim Ayatrisya is the “best AI.”

## What works today

- **Study:** Chat offers an “Explain a concept” starter. Research notes provide source-log and question-map templates saved in the browser; there is no automated research or web search.
- **Writing:** Chat offers a “Help me write” starter. Documents can be drafted, reopened, and exported as Markdown or plain text. Neither flow has produced a verified model response.
- **Coding:** Users can create and export coding specifications and store a ZIP in browser storage. The ZIP is not extracted, executed, or sent to a model. Direct local-folder work is a separate Desktop capability with approved operations; AI-generated code has not been verified.
- **Chat and storage:** The chat UI saves user messages locally and reports model unavailability rather than inventing a response.

## Live model check

An authenticated Firebase test account was used for a real request:

- `GET /api/model/health` → **503**, `The Ayatrisya model endpoint is not configured.`
- `POST /api/model/chat` with a minimal test prompt → **503**, the same message.

The configured hosted endpoint is HTTP and private/local. The server rejects it before forwarding the prompt upstream. **No model received the test prompt; live inference is not verified.** The development gateway now returns a specific configuration message for this case: hosted requests require HTTPS, and local/private model URLs belong in Ayatrisya Desktop settings.

## User-validation plan

Run AI-quality sessions only after **Task #26 (Confirm signed-in browsers receive real Ayatrisya model responses)** passes a live inference test. Until then, participants can assess navigation and local drafting, but not AI quality.

For an initial formative round, recruit real students/learners and independent creators. Ask each participant to try the relevant workflow:

1. **Study:** ask for an explanation and a short self-check; compare claims with a source the participant trusts.
2. **Writing:** create a short draft with constraints, then revise it; note how much editing was required.
3. **Coding:** describe a small change, review the proposed plan, and—only when live inference and Desktop operations are verified—review an explicitly approved change.

Record the participant’s audience, task completion, points of confusion, corrections needed, perceived usefulness, and whether they would use the workflow again. Use anonymized notes; do not record or publish personal details without permission. A small first round is exploratory, not proof of market demand.

## Dependencies and next step

- **Task #26** is the next implementation priority for real chat inference.
- Keep a desktop-local URL in Ayatrisya Desktop settings. It cannot serve as the hosted web endpoint.
- For web chat, configure an Ametesx-operated model service at a reachable public HTTPS endpoint, then rerun authenticated health and inference checks.
- **Task #17 (Run Ayatrisya’s own image, 3D, and music models for real)** already covers real media generation. Existing model tasks also cover reusable assistants and hosted limits/jobs; no duplicate model task is needed.

**Validation status:** no external target-user feedback has been collected yet. The audience decision remains provisional.
