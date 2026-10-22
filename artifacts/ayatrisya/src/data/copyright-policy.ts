/**
 * Shared Ametesx/Ayatrisya copyright wording.
 *
 * Scope is deliberately conditional: the root package declares MIT, but the
 * intended scope of that declaration has not been resolved. This policy must
 * not override an applicable open-source or third-party license.
 */
export type CopyrightProduct = 'Ayatrisya';

export function copyrightNotice(product?: CopyrightProduct): string {
  const year = new Date().getFullYear();
  return product
    ? `© ${year} Ametesx · ${product}. All rights reserved.`
    : `© ${year} Ametesx. All rights reserved.`;
}

export const ownershipScopeStatement =
  'Ametesx claims rights only in original materials that it owns or is authorized to protect. Product inclusion or repository presence alone does not establish authorship, assignment, license, or exclusive ownership.';

export const originalMaterialsProtectionStatement =
  'Where Ametesx owns or is authorized to protect the material, original software, content, documentation, designs, and other intellectual property may be protected by applicable intellectual-property laws. Rights are reserved only to the extent Ametesx owns or is authorized to enforce them. For material verified as proprietary and not governed by another license, no permission to copy, modify, redistribute, commercially exploit, or use Ametesx-owned branding is granted except as expressly authorized by Ametesx or permitted by applicable law. Applicable open-source and third-party licenses remain controlling for the material they cover.';

export const ownershipCategories = [
  'Ametesx website source code and original content, where ownership is verified.',
  'Ayatrisya application code and original user-interface designs, where ownership is verified.',
  'Original logos, illustrations, graphics, and visual assets, where ownership is verified.',
  'Original documentation, written material, and marketing content, where ownership is verified.',
  'Original tools, utilities, and model code created by or lawfully assigned or licensed to Ametesx.',
  'Other original work created by or lawfully assigned or licensed to Ametesx.',
];

export const thirdPartyIntellectualPropertyStatement =
  'Third-party dependencies, pretrained models, datasets, fonts, icons, libraries, rules, and externally generated assets remain subject to their respective owners and license terms. Ametesx does not claim third-party ownership merely because material is used, integrated, hosted, or distributed with an Ametesx product.';

export const rightsContactStatus =
  'Copyright and IP enquiries: official rights-request contact details are not available yet.';
