# Ametesx / Ayatrisya intellectual-property inventory

**Internal owner-review document — not a public ownership or legal opinion.**  
Review date: 2026-10-21

## Scope and conclusion

This review covers the checked Replit workspace: the pnpm monorepo, including
`artifacts/ayatrisya`, `artifacts/api-server`, `lib/*`, and the repository-level
documentation. No separate Ametesx website repository was present in the
workspace, and this review does not establish the contents of a remote
repository or deployed build.

The owner's stated intention is to protect original work Ametesx can lawfully
own or control, without claiming third-party material. Source files and assets
prove that files are present in this workspace; they do not by themselves prove
who created them, who owns them, or whether rights were assigned.

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

| Asset group | Workspace evidence | Creator / creation evidence | License and current ownership status | Owner action |
|---|---|---|---|---|
| Ayatrisya web, API, and shared source code | `artifacts/ayatrisya/src/**`, `artifacts/api-server/src/**`, `lib/**`, and scripts | Individual authors and contribution history are not established by the source snapshot. No contributor assignment records were found in the checked workspace. | Root MIT scope is unresolved; app and workspace packages are private with no package-level license. Ametesx ownership is not established merely by repository location. | Identify contributors and work-for-hire/assignment or license evidence. Decide the root MIT scope before adding a source-wide proprietary notice or distributing the source. |
| Website copy, product documentation, and legal pages | `PublicSite.tsx`, `PublicPages.tsx`, `public-docs.ts`, and `artifacts/ayatrisya/docs/**` | Mixed and unverified. Some text reflects the owner's supplied instructions; some was drafted with AI assistance. The repository does not provide a complete authorship or rights record. | No blanket ownership claim is made. Third-party quotations, notices, and license obligations remain separate. | Preserve the source prompts and editing history where useful; review third-party text and confirm any contributor rights before making exclusive ownership claims. |
| Ayatrisya logo, favicon, and desktop icons | `artifacts/ayatrisya/public/brand/ayatrisya-mark.svg`, `favicon.svg`, `favicon.ico`, `ayatrisya-desktop.png`, `ayatrisya-desktop.ico` | The owner requested a logo replacement and the resulting files are present in the workspace. The specific designer/tool, source drafts, and assignment or platform terms are not recorded in the assets. | Intended Ametesx/Ayatrisya identity; legal ownership and any trademark status are not verified. No registration claim is made. | Preserve original editable sources, dated drafts, and applicable generation/tool terms; confirm the rights chain before asserting exclusive ownership. |
| Built-in wallpaper presets | `artifacts/ayatrisya/src/data/wallpapers.ts`; the personalization test confirms 70 unique inline SVG data-URI presets | The SVG source is embedded in the code, but creator and creation-process metadata are not recorded. | No per-asset license or ownership record is present. Do not treat the test or repository location as proof of authorship. | Record the creator and source process for each preset or replace any unverified preset before making exclusive-rights claims. |
| User-selected custom wallpaper and user content | Custom wallpaper is stored as user-provided data in the local workspace; conversations and attachments are user content | Created or supplied by individual users; Ametesx authorship is not asserted. | No blanket Ametesx ownership claim. | Keep the product's user-content terms separate from this inventory; do not include user data in an Ametesx asset claim. |
| Fonts | `index.html` and `src/index.css` request DM Sans, Manrope, and IBM Plex Mono from Google Fonts; no font files are bundled in `public/` | Third-party font families; exact upstream designers and source records are not inventoried here. | Third-party service and licenses. Family-specific license texts are not vendored in this repository, so the exact notices have not been independently verified in this review. | Keep this as an external font load unless the owner verifies each family license and required notices before self-hosting or bundling fonts. |
| UI icon libraries | Installed metadata reports `lucide-react` 0.545.0 as ISC and `react-icons` 5.7.0 as MIT | Upstream library authors and maintainers, not Ametesx. | Their package licenses apply to those libraries, not to the Ayatrisya brand mark. Other dependencies remain subject to their own licenses. | Preserve upstream license and attribution requirements in source and desktop releases. Include these in the complete release SBOM. |
| Other application dependencies | Root/app manifests and `pnpm-lock.yaml`; selected direct dependency attributions are described at `/licenses` | Upstream package authors. | The current license page is a selected inventory, not a complete transitive SBOM. The root MIT declaration does not settle the license of each dependency or first-party asset. | Generate and review a complete direct/transitive license inventory for each shipped web and desktop build. |
| WAR MODE scanner and rules | `artifacts/ayatrisya/war-mode-assets/windows-x64/` and `artifacts/ayatrisya/docs/WAR-MODE.md` | YARA-X is from VirusTotal; the baseline rules are from the reviewed Neo23x0 Signature-Base snapshot; individual rule authors are identified in rule metadata when supplied. | The checked notices identify YARA-X v1.22.0 under BSD-3-Clause and the selected 711 Signature-Base source files under DRL 1.1, with explicit license exclusions and required attribution. These are third-party materials, not Ametesx-owned IP. | Keep both license texts, the notice, rule metadata, and author attribution with every redistributed scanner package; re-review any baseline change. |
| Models, model code, and datasets | No model-weight or dataset files were found under `artifacts/ayatrisya`; the app routes inference to a configured endpoint | Model implementation, training data, and endpoint operator are outside this workspace and not verified here. | No Ametesx ownership claim is made for remote models, weights, or datasets. Their licenses and terms are unresolved. | Obtain an asset and license inventory from the model-service owner before describing model code or weights as Ametesx-owned or bundling them. |
| Generated media and model output | No generated model files or datasets were found in the checked source tree | Output may be generated by the configured service or supplied by users; the endpoint's generation terms are not available in this workspace. | No guarantee of originality and no ownership claim is made here. | Review endpoint terms and user-facing content terms; assess output rights individually where needed. |
| Replit/platform, contractor, and contributor work | Workspace metadata identifies a Replit-hosted project; no completed assignment records were found in the checked repository | Platform contributors, the owner, Replit Agent, and other contributors may have participated; exact authorship is not established by this inventory. | Applicable platform terms and any contributor/contractor assignments were not examined or evidenced here. | Review applicable platform terms and contributor agreements; obtain appropriate professional advice before executing any agreement or assignment. |

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
6. Keep `/copyright` in draft status and keep the rights-request contact marked
   pending until a verified, monitored channel and the ownership records are
   available.

