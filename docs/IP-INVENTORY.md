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

The root `package.json` is both `"private": true` and `"license": "MIT"`, but no
root `LICENSE` text was found. Each checked workspace package is private and
does not declare a package license. The scope of the root MIT declaration is
therefore unresolved. Do not assume it applies only to dependencies, or that it
grants a license to every product asset. Do not add a blanket proprietary
source-code notice or change the license until the owner resolves the scope.

The public footer currently uses `© 2026 Ametesx. All rights reserved.` followed
by a qualification that the notice applies only to material Ametesx owns or is
authorized to protect. This is a site notice, not proof of ownership of every
repository file.

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
- No blanket copyright header was added to source files because the root MIT
  scope, individual authorship, and assignment evidence are unresolved.
- Copyright documentation does not require a trademark registration. This
  inventory makes no trademark-registration or patent claim.
- Any future notice must identify only material with a verified rights basis,
  preserve third-party notices, and not override an applicable open-source,
  font, model, dataset, or platform license.

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

