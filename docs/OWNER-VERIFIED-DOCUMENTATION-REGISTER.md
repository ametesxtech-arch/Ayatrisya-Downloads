# Ametesx owner-verified documentation and IP register

**Internal only — do not publish this register.**  
**Reviewed:** 2026-10-22. This is the date of this workspace review, not an
effective date, legal approval, or confirmation of a production deployment.

## Scope and status key

This review covers the files present in this Replit workspace. It does not
verify a remote repository, the currently deployed build, live provider
configuration, or any service operator outside this workspace.

- **Owner-confirmed:** explicitly stated by the product owner. This is not, by
  itself, proof of a legal assignment, registration, third-party permission, or
  enforceable right.
- **Implementation-verified:** supported by the checked source or configuration.
  It may still depend on deployment settings or a live integration test.
- **Externally identified:** a third-party notice or package metadata is present.
  This is not a substitute for a complete release SBOM or legal review.
- **Pending:** evidence or approval is missing. Do not present the claim as
  verified.

## Document register

| Document and location | Status | Material claims and source | Verification | Outstanding action | Last reviewed |
|---|---|---|---|---|---|
| Documentation hub — public `/documentation`; `artifacts/ayatrisya/src/data/public-docs.ts`, `PublicPages.tsx` | Public | Product identity, supported workflows, local/web/desktop boundaries, model and storage behavior. | Ayatrisya being an Ametesx product is owner-confirmed. Feature and storage descriptions are implementation-derived and deployment-dependent. | Reconcile any change in the shipped implementation or deployment configuration before describing a capability as available. | 2026-10-22 |
| Privacy Policy — public `/privacy`; draft at `artifacts/ayatrisya/docs/PRIVACY-POLICY-DRAFT.md` | Public route is an unpublished notice; draft is internal and not effective. | Browser storage, Firebase, Drive, GitHub/Figma, hosted model, and desktop-local data flows are described from client/API source and `LOCAL-DATA-AND-INTEGRATIONS.md`. | Product relationship is owner-confirmed; described code paths are implementation-verified. Production operators, regions, logs, retention, and legal basis are pending. | Confirm actual operator, hosting and provider terms, regions, retention/deletion, monitored privacy contact, applicable jurisdictions, qualified legal review, then approve an effective date. | 2026-10-22 |
| Terms of Service — public `/terms`; `publicLegalPages` in `public-docs.ts` | Public draft; `reviewed: false`. | Use, account security, output limitations, availability, IP, termination, and liability text is proposed draft language. | Implementation observations are code-derived; no binding acceptance or legal approval is asserted. | Confirm service operator, effective date, notice/contact process, governing law, and qualified legal review. | 2026-10-22 |
| Contact — public `/contact` | Public unpublished notice; no contact details are supplied. | The route states that no verified monitored contact is available. | Implementation-verified from the current route and source. | Configure and verify real monitored channels before publishing contact or rights-request instructions. | 2026-10-22 |
| Copyright and Intellectual Property — public `/copyright`; shared copy in `artifacts/ayatrisya/src/data/copyright-policy.ts`; `publicLegalPages` in `public-docs.ts`; internal `docs/IP-INVENTORY.md` | Public draft; `reviewed: false`. | Ayatrisya is an Ametesx product; owner-supplied policy states an intention to protect original work Ametesx lawfully owns or controls while respecting third-party rights. | Product relationship and stated intent are owner-confirmed. Ownership of individual assets, authorship, assignments, registrations, and enforcement authority are pending. | Resolve contributor and asset provenance, root-license scope, rights-request contact, and any registration claims. Keep the page in draft until qualified review and owner approval. | 2026-10-22 |
| Third-party Licenses and Attributions — public `/licenses`; `publicLegalPages` in `public-docs.ts` | Public selected inventory; `reviewed: false`. | Lists selected direct dependencies and scanner notices based on manifests, package metadata, and bundled notices. | Identified third-party licenses/notices are externally sourced from the checked packages and bundled files. The page explicitly is not a complete SBOM. | Generate and review a complete direct/transitive inventory for each release; verify fonts, assets, and model/data licenses separately. | 2026-10-22 |
| Cookies and Storage Notice — public `/cookies`; `publicLegalPages` in `public-docs.ts` | Public draft; `reviewed: false`. | Browser cookie, IndexedDB, localStorage, and optional remote storage behavior. | Implementation-derived from the checked client code; production analytics/CDN/provider behavior is not established by source alone. | Complete deployment and provider review and qualified legal review before treating as final. | 2026-10-22 |
| Public footer — `artifacts/ayatrisya/src/components/PublicSite.tsx`, shared wording in `copyright-policy.ts` | Public | Identifies Ayatrisya as an Ametesx product, links public documentation/legal routes, and limits the dynamic Ayatrisya notice to material Ametesx owns or is authorized to protect. | Product identity is owner-confirmed; links and displayed notice are implementation-verified. | Keep the qualification and all public legal/documentation links; do not imply ownership of third-party material. | 2026-10-22 |
| Internal privacy and integration evidence — `artifacts/ayatrisya/docs/PRIVACY-POLICY-DRAFT.md`, `LOCAL-DATA-AND-INTEGRATIONS.md`, `docs/MODEL-GATEWAY.md` | Internal | Documents client storage and configured Firebase, Drive, GitHub/Figma, model gateway, and desktop-local request paths. | Code paths are implementation-verified; live provider configuration and remote operators/retention are pending. | Recheck after production deployment and provider changes; obtain endpoint and service-provider terms from their operators. | 2026-10-22 |
| Internal publication blockers — `artifacts/ayatrisya/docs/LEGAL-PUBLICATION-BLOCKERS.md` | Internal | Tracks unresolved privacy, operator, contact, deployment, licensing, and ownership items. | Current blockers were checked against source and workspace configuration. | Resolve items before changing any legal page's draft/unpublished status. | 2026-10-22 |
| Owner-supplied IP and documentation briefs — files in `attached_assets/` | Internal source material; not public legal instruments | Confirms the owner's product attribution and stated intention for eligible original Ametesx work; directs that third-party rights and missing legal facts not be invented. | Owner-confirmed intent only. The briefs are not executed contributor assignments, licenses, company records, or proof of ownership for specific assets. | Preserve as review inputs; obtain actual ownership, assignment, and license evidence where needed. | 2026-10-22 |
| Ayatrisya artifact metadata — `artifacts/ayatrisya/.replit-artifact/artifact.toml` | Workspace deployment metadata | Its description still says this is a UI prototype and that AI, storage, OAuth, and cloud services are not implemented. | The description conflicts with the checked source, which contains those implementations. It does not prove those services are configured or deployed. | Reconcile the metadata with the intended release and verified deployment. Do not infer production availability from source presence. | 2026-10-22 |

## Claim register

| Claim or asset group | Source and verification class | Current conclusion | Evidence still required |
|---|---|---|---|
| Ayatrisya is an Ametesx product | Product owner confirmation; **owner-confirmed** | May be stated as product identity. It does not establish ownership of every component or the legal identity of the service operator. | No further evidence is needed for product attribution; legal-operator identity remains separate. |
| Original Ametesx/Ayatrisya code, designs, copy, logos, and wallpapers | `docs/IP-INVENTORY.md`, repository assets and history; **pending** | Presence in the product or repository does not establish who created it or whether rights were assigned. Creator/tool provenance is incomplete for several groups. | Creator records, platform/tool terms, contributor/contractor assignments or licenses, and source files where applicable. |
| User content and generated output | Product implementation and model route; **implementation-verified / pending terms** | No blanket Ametesx ownership claim is made. Endpoint output terms and third-party rights are not established. | Model-service terms, data/model provenance, and approved user-content terms. |
| Root source license | Root `package.json` declares `"license": "MIT"` and `"private": true`; no tracked root `LICENSE` file was found. Workspace package manifests are private and do not declare package licenses. **Implementation-verified; scope unresolved.** | Do not assume MIT applies only to dependencies, only to application code, or to all brand/assets. Do not add a blanket proprietary or open-source claim. | Owner decision on intended scope, supported by qualified licensing review; check each package and release notice. |
| Contributor and assignment records | Tracked repository contains no `CONTRIBUTING`, CLA, assignment, or rights-agreement records in the checked tree; **pending** | Git history or file presence alone cannot prove a valid transfer of rights. | Identify contributors and obtain/document applicable agreements or licenses. |
| Third-party software and scanner | Package metadata plus `war-mode-assets/windows-x64/LICENSE-*`, `NOTICE.txt`, and `docs/WAR-MODE.md`; **externally identified** | Scanner engine/rules are third-party materials with separate notices; they are not Ametesx-owned merely because they are bundled. The public `/licenses` inventory is selected, not a full SBOM. | Per-release license/SBOM review and preservation of required notices. |
| Fonts and other visual dependencies | `index.html`, `src/index.css`, manifests and installed package metadata; **externally identified / incomplete** | Fonts load from Google Fonts; installed icon-library metadata identifies third-party licenses. No complete asset-level provenance or release SBOM is established. | Verify family-specific notices, remaining packages, and distribution requirements before bundling. |
| Firebase, Drive, GitHub/Figma, and hosted model data flows | Client/API source, `.env.example`, `firestore.rules`, `LOCAL-DATA-AND-INTEGRATIONS.md`; **implementation-verified / deployment-dependent** | Source identifies code paths and required configuration names. It does not establish that providers are enabled, production rules are deployed, or what provider regions/logging/retention apply. | Confirm production project ownership, regions, live rules, OAuth configuration, provider terms, endpoint operator, logging, retention, and deletion processes. |
| Deployment description | `artifact.toml`; **implementation-verified conflict** | Metadata describes an earlier UI-only prototype and is stale relative to current source. Source presence still does not prove deployment. | Owner/release decision and production verification before updating public deployment claims. |

## Approval and publication rules

1. Only the product relationship and stated ownership intent are owner-confirmed
   by the supplied material. Do not label the entire documentation set
   “owner-verified.”
2. Keep `/privacy` unpublished with its effective date pending until the
   operator, data recipients/retention, verified privacy contact, and qualified
   legal review are complete.
3. Keep `/terms`, `/copyright`, `/licenses`, and `/cookies` visibly in draft
   status until their documented owner and legal actions are resolved.
4. Do not publish this internal register, private deployment settings, secret
   values, or internal-only review notes.
5. Revisit this register when the production build, ownership evidence,
   licenses, provider configuration, or owner-approved legal text changes.
