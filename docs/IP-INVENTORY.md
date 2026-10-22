# Ametesx / Ayatrisya intellectual-property inventory

**Internal owner-review document — not a public ownership or legal opinion.**  
Review date: 2026-10-22

See `OWNER-VERIFIED-DOCUMENTATION-REGISTER.md` for the document-by-document
claim sources, verification status, review date, and outstanding owner actions.

## Scope and conclusion

This review covers the checked Replit workspace: the pnpm monorepo, including
`artifacts/ayatrisya`, `artifacts/api-server`, `lib/*`, and the repository-level
documentation. No separate Ametesx website repository was present in the
workspace, and this review does not establish the contents of a remote
repository or deployed build.

The product owner has confirmed that Ayatrisya is an Ametesx product. This
confirms the product relationship, not the authorship, ownership, assignment,
license, registration, or exclusive rights for any specific asset. The owner's
stated intention is to protect original work Ametesx can lawfully own or
control, without claiming third-party material. Source files and assets prove
that files are present in this workspace; they do not by themselves prove who
created them, who owns them, or whether rights were assigned.

At the start of this audit, the root `package.json` was both `"private": true`
and `"license": "MIT"`, but no root `LICENSE` text or tracked nested license
file was found. Each checked workspace package is private and does not declare
a package license. On 2026-10-22, at the owner's direction, the root metadata
was changed to `"UNLICENSED"` to avoid signaling a public MIT license for future
workspace use. This change is prospective only: it does not revoke or erase
any rights that may have been granted by the earlier MIT metadata or any prior
distribution. The exact scope of that historical declaration and whether any
distribution relied on it remain unresolved; do not claim the material became
proprietary retroactively.

The public footer uses a product-specific, current-year Ayatrisya notice,
qualified to apply only to material Ametesx owns or is authorized to protect.
This is a site notice, not proof of ownership of every repository file.

## Asset inventory

| Asset group | Workspace evidence | Provenance classification and creator evidence | License and current ownership status | Owner action |
|---|---|---|---|---|
| Ayatrisya web, API, and shared source code | `artifacts/ayatrisya/src/**`, `artifacts/api-server/src/**`, `lib/**`, and scripts | **Contributor/platform-assisted or unknown.** Individual authorship and contribution history are not established. No assignment records were found. No source group is verified as solely owner-created by the checked records. | Root MIT scope is unresolved; app and workspace packages are private with no package-level license. Ametesx ownership is not established merely by repository location. | Identify contributors and work-for-hire/assignment or license evidence. Decide the root MIT scope before adding a source-wide proprietary notice or distributing the source. |
| Website copy, product documentation, and legal pages | `PublicSite.tsx`, `PublicPages.tsx`, `public-docs.ts`, `copyright-policy.ts`, and `artifacts/ayatrisya/docs/**` | **Mixed owner-supplied, AI-assisted, and unknown authorship.** The repository does not provide a complete authorship or rights record. | No blanket ownership claim is made. Third-party quotations, notices, and license obligations remain separate. | Preserve source prompts and editing history where useful; review third-party text and confirm any contributor rights before making exclusive ownership claims. |
| Ayatrisya logo, favicon, and desktop icons | `artifacts/ayatrisya/public/brand/ayatrisya-mark.svg`, `favicon.svg`, `favicon.ico`, `ayatrisya-desktop.png`, `ayatrisya-desktop.ico` | **External-tool/platform origin or creator unknown.** The owner requested a logo replacement and the resulting files are present; the specific designer/tool, source drafts, and assignment or platform terms are not recorded. | Intended Ametesx/Ayatrisya identity; legal ownership and any trademark status are not verified. No registration claim is made. | Preserve editable sources, dated drafts, and applicable generation/tool terms; confirm the rights chain before asserting exclusive ownership. |
| Built-in wallpaper presets | `artifacts/ayatrisya/src/data/wallpapers.ts`; the personalization test confirms 70 unique inline SVG data-URI presets | **Creator/tool origin unknown.** The SVG source is embedded in the code, but creator and creation-process metadata are not recorded. | No per-asset license or ownership record is present. Do not treat the test or repository location as proof of authorship. | Record the creator and source process for each preset or replace any unverified preset before making exclusive-rights claims. |
| User-selected custom wallpaper and user content | Custom wallpaper is stored as user-provided data in the local workspace; conversations and attachments are user content | **User-created or user-supplied.** Ametesx authorship is not asserted. | No blanket Ametesx ownership claim. | Keep user-content terms separate from this inventory; do not include user data in an Ametesx asset claim. |
| Fonts | `index.html` and `src/index.css` request DM Sans, Manrope, and IBM Plex Mono from Google Fonts; no font files are bundled in `public/` | **Third-party service and font families.** Exact upstream designers and source records are not inventoried here. | Family-specific license texts are not vendored, so exact notices have not been independently verified in this review. | Keep external font loading unless the owner verifies each family license and required notices before self-hosting or bundling. |
| UI icon libraries | Installed metadata reports `lucide-react` 0.545.0 as ISC and `react-icons` 5.7.0 as MIT | **Third-party libraries and authors.** | Their package licenses apply to those libraries, not to the Ayatrisya brand mark. Other dependencies remain subject to their own licenses. | Preserve upstream license and attribution requirements in source and desktop releases; include these in the complete release SBOM. |
| Other application dependencies | Root/app manifests and `pnpm-lock.yaml`; selected direct dependency attributions are described at `/licenses` | **Third-party packages.** | The current license page is a selected inventory, not a complete transitive SBOM. The root MIT declaration does not settle the license of each dependency or first-party asset. | Generate and review a complete direct/transitive license inventory for each shipped web and desktop build. |
| WAR MODE scanner and rules | `artifacts/ayatrisya/war-mode-assets/windows-x64/` and `artifacts/ayatrisya/docs/WAR-MODE.md` | **Third-party engine and rule authors.** YARA-X is from VirusTotal; the baseline rules are from the reviewed Neo23x0 Signature-Base snapshot; individual authors are identified in rule metadata where supplied. | Checked notices identify YARA-X v1.22.0 under BSD-3-Clause and 711 selected Signature-Base source files under DRL 1.1, with explicit exclusions and required attribution. These are not Ametesx-owned IP. | Keep both license texts, notices, rule metadata, and attribution with redistributed scanner packages; re-review baseline changes. |
| Models, model code, and datasets | No model-weight or dataset files were found under `artifacts/ayatrisya`; inference routes to a configured endpoint | **Remote implementation/provider and training data unknown.** No in-workspace model weights or datasets were identified. | No Ametesx ownership claim is made for remote models, weights, or datasets. Their licenses and terms are unresolved. | Obtain model and dataset provenance and license details from the model-service owner before describing model code or weights as Ametesx-owned or bundling them. |
| Generated media and model output | No generated model files or datasets were found in the checked source tree | **Remote-service-generated or user-supplied; exact origin unknown.** The endpoint's generation terms are not available. | No guarantee of originality and no ownership claim is made here. | Review endpoint terms and user-facing content terms; assess output rights individually where needed. |
| Replit/platform, contractor, and contributor work | Workspace metadata identifies a Replit-hosted project; no completed assignment records were found in the checked repository | **Platform-, contractor-, contributor-, or owner-origin may apply; specific authorship is not established.** | Applicable platform terms and any contributor/contractor assignments were not examined or evidenced here. | Review applicable platform terms and contributor agreements; obtain appropriate professional advice before executing any agreement or assignment. |

## Copyright notices and trademark boundaries

- The public website footer's notice is limited by the adjacent statement:
  “This notice applies only to material Ametesx owns or is authorized to
  protect.”
- The proprietary notice is scoped to original material Ametesx owns or is
  authorized to license. Source-entrypoint notices do not prove authorship or
  assignment and do not override third-party or previously granted licenses.
- Copyright documentation does not require a trademark registration. This
  inventory makes no trademark-registration or patent claim.
- Any future notice must identify only material with a verified rights basis,
  preserve third-party notices, and not override an applicable open-source,
  font, model, dataset, or platform license.

## Brand use and trademark readiness

- [ ] Search the relevant official trademark registries and name databases for
  Ametesx and Ayatrisya in owner-selected markets and product classes.
- [ ] Confirm name availability and obtain qualified trademark advice before
  filing or making any registration, exclusivity, or enforceability claim.
- [ ] Preserve original and editable logo files, dated drafts, creator/tool
  provenance, and applicable platform or assignment terms.
- [ ] Keep third-party and platform-generated marks distinct from first-party
  brand assets; do not assume repository presence proves ownership.

No search, filing, registration, or clearance was performed in this workspace.

## Technical protection and verification limits

- `.replit` contains the Firebase web API key as public client configuration.
  It is not a server credential and is expected to be visible to browser code;
  it must be restricted to the required Firebase APIs and authorized domains.
  No server-secret value was identified in tracked source by the key-pattern
  check; one private-key-shaped test fixture is an intentional negative test.
- The web client is delivered to browsers and can be inspected or copied.
  Production source maps are disabled; that does not hide or make the bundled
  JavaScript impossible to inspect.
- The Firebase web API key is public client configuration required by the
  Firebase browser SDK, not a server credential. Restrict its permitted APIs and
  authorized domains in the Firebase/Google Cloud project; enforce access with
  Firebase Authentication and Firestore rules. The key must never authorize
  privileged server operations.
- The checked Firestore rule limits personalization documents to the
  authenticated user's UID and validates allowed fields and sizes.
- The API validates Firebase identity for model and connector routes. Hosted
  model requests use a server-side key; browser code does not receive that key.
- Only an internal backup remote is configured; no source-hosting remote is
  configured. Repository visibility, branch protections, GitHub Actions
  secrets, and production deployment permissions could not be verified here.
- `.env` is ignored by Git and the only tracked environment template is
  `.env.example`. Deployment secret values and production access policies are
  not visible in this source audit.

## Repository license audit

- No root `LICENSE` file or tracked nested `LICENSE`, `LICENCE`, `COPYING`, or
  `NOTICE` file exists. The root MIT declaration was package metadata; its
  historic scope is recorded in `docs/PROPRIETARY-SOFTWARE-NOTICE.md`.
- The Windows WAR MODE preparation script recreates and packages YARA-X's
  BSD-3-Clause license, the Signature-Base Detection Rule License (DRL) 1.1,
  and a provenance notice. These files are in the ignored build-assets folder,
  not tracked source. They cover the scanner engine and selected rule files,
  not Ayatrisya's original source code.
- Electron's generated `LICENSE.electron.txt` covers Electron's distribution;
  generated Chromium credits cover Chromium components. These are build output,
  not licenses for Ayatrisya source.
- The pnpm `--prod` selector for the Ayatrisya workspace reports 69 installed
  package entries declaring MIT. This is not a complete browser-runtime
  inventory: the Vite app also bundles packages declared under `devDependencies`.
  The full installed Ayatrisya graph reports 717 packages with mixed licenses,
  including three development plugins with unknown metadata and two MPL-2.0
  Lightning CSS packages. The API production graph reports 101 packages
  (92 MIT, 1 Apache-2.0, 7 ISC, 1 BSD-3-Clause). These are package metadata
  snapshots, not a release SBOM or a legal compatibility opinion.
- The public `/licenses` page is intentionally a selected inventory, not a
  complete list of every dependency or packaged component. Keep upstream
  notices and generate a release-specific license inventory before
  distribution.

## Immediate preservation steps and unresolved decisions

1. Preserve repository history, source assets, editable design files, dated
   drafts, prompts, and contributor records; do not treat timestamps alone as
   proof of ownership.
2. Resolve the root MIT declaration's intended scope with qualified advice
   before changing package metadata or adding a root license/notice.
3. Verify authorship and rights for the logo, wallpaper presets, website copy,
   generated assets, contractor contributions, and platform-assisted work.
4. Verify the font-family licenses and create a complete release SBOM and
   attribution set before bundling or redistributing assets.
5. Obtain model and dataset provenance and license details from the configured
   endpoint owner before making claims about original Ayatrisya models.
6. Keep `/copyright` limited to conditional, source-supported information.
   Internal approval and rights-provenance status remain in the publication
   checklist; do not imply verified ownership beyond the evidence recorded here.

