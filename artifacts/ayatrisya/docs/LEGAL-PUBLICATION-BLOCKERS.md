# Legal publication checklist — internal

**Repository-only review checklist. Never render this file on the public site.**
The document and claim evidence is tracked in the internal register at
`../../../docs/OWNER-VERIFIED-DOCUMENTATION-REGISTER.md`.

## Privacy Policy

- [ ] Confirm the actual legal/service operator. The product owner has confirmed
  Ayatrisya is an Ametesx product; this does not establish the legal operator.
- [ ] Configure and verify a monitored privacy contact.
- [ ] Confirm production hosting/API operator, regions, CDN, and access-log
  practices.
- [ ] Reconcile the web artifact's stale UI-only description with the current
  implementation and confirm which build is deployed.
- [ ] Confirm Firebase project owner, Firestore region, deployed rules, and
  retention/deletion settings.
- [ ] Confirm the model endpoint operator, region, model/service terms, logging,
  training use, and retention/deletion behavior.
- [ ] Confirm Google Drive, GitHub, Figma, and Google Fonts data flows and
  provider terms applicable to production.
- [ ] Define account deletion and cloud-data deletion procedures; the current app
  has no in-app account deletion and cannot delete its Firestore personalization
  document.
- [ ] Have qualified counsel determine applicable legal requirements after the
  operator and user locations are confirmed.
- [ ] Approve the policy and set its effective date only after the preceding
  items are resolved.

**Public state:** `/privacy` shows that the official policy is not available.
The evidence-based draft is internal and is not imported into the web bundle.
No effective date or privacy guarantee is displayed.

## Terms of Service

- [ ] Confirm the service operator and intended contractual relationship.
- [ ] Review account security, permitted use, AI output limitations, feature
  availability, third-party services, intellectual property, termination,
  warranty, liability, and notice procedures with qualified counsel.
- [ ] Decide whether and how users accept final terms. The current page does not
  record acceptance of an agreement.
- [ ] Confirm any effective date and jurisdiction with the owner and counsel.

**Public state:** `/terms` is informational use guidance. It explicitly does
not record acceptance of an agreement. This does not mean final terms have been
approved.

## Copyright and IP page

- [ ] Confirm the root `package.json` MIT declaration scope. No root `LICENSE`
  text was found in the checked repository; do not treat the manifest alone as
  proof that all product materials are MIT-licensed.
- [ ] Review the internal asset/provenance inventory at
  `../../../docs/IP-INVENTORY.md` and
  `../../../docs/OWNER-VERIFIED-DOCUMENTATION-REGISTER.md`; resolve unknown
  creators, evidence, licenses, and ownership actions.
- [ ] Confirm package-level license declarations, repository notices, and
  third-party attributions for each published web/desktop build.
- [ ] Inventory authorship of code and creative work, including founder,
  employee, contractor, and other contributor work; obtain written assignments
  or licenses where required.
- [ ] Verify rights to logos, fonts, icons, models, datasets, generated media,
  and other bundled assets. Preserve all third-party notices.
- [ ] Confirm trademark/copyright registration status before making registration
  or exclusive-rights claims.
- [ ] Configure a real, monitored rights-request contact before publishing the
  page as final.

**Public state:** `/copyright` provides conditional ownership information,
product-specific notice, and third-party license qualifications. It does not
claim that every product asset is owned by Ametesx. This checklist, not the
public page, tracks approval and provenance blockers.

## Contact, Licenses, and Storage

- [ ] Add only verified, monitored contact channels; do not publish
  placeholders.
- [ ] Generate a complete release SBOM and verify all bundled software, fonts,
  models, datasets, rules, and assets before distribution.
- [ ] Recheck analytics, CDN, hosting, and injected scripts against the actual
  production deployment before making privacy or cookie assurances.

**Public state:** `/contact` says official contact details are unavailable.
`/licenses` identifies selected notices and states that it is not a complete
inventory. `/cookies` describes checked source behavior and does not claim to
describe deployment-provider collection.
