# Legal publication blockers — internal

These are implementation and owner-review blockers, not public contact details.
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
- [ ] Approve and set the effective date only after the preceding items are
  resolved.

**Current state:** The public `/privacy` route only shows “not published” and
“Effective date: Pending owner and qualified legal approval.” The evidence-based draft is in
`PRIVACY-POLICY-DRAFT.md` and is not imported into the web bundle.

## Copyright and IP page

- [ ] Confirm the root `package.json` MIT declaration scope. No root `LICENSE`
  text was found in the checked repository; do not treat the manifest alone as
  proof that all product materials are MIT-licensed.
- [ ] Review the internal asset/provenance inventory at `../../../docs/IP-INVENTORY.md`
  and resolve unknown creators, evidence, licenses, and ownership actions.
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

**Current state:** `/copyright` remains visibly marked for owner/legal review.
The text makes ownership conditional on verified authorship and rights and does
not claim that any transfer, registration, or license has been completed.
