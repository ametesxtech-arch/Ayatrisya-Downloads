/**
 * Shared Ametesx/Ayatrisya copyright and proprietary-software wording.
 *
 * This wording applies only to original material Ametesx owns or is authorized
 * to license. It does not override third-party terms or revoke prior grants.
 * See docs/PROPRIETARY-SOFTWARE-NOTICE.md for the repository license history.
 */
export type CopyrightProduct = 'Ayatrisya';

export function copyrightNotice(product?: CopyrightProduct): string {
  const year = new Date().getFullYear();
  return product
    ? `© ${year} AMETESX · ${product}. All rights reserved.`
    : `© ${year} AMETESX. All rights reserved.`;
}

export const proprietarySoftwareNotice =
  'AYATRISYA is a product of AMETESX. No public license is granted to copy, modify, redistribute, or commercially reuse original material Ametesx owns or is authorized to license unless expressly authorized. Subject to applicable law and third-party rights, Ametesx claims ownership of its original product identity, logos, visual assets, proprietary source code, original UI/UX designs, documentation, and website architecture. Open-source components are not owned by Ametesx and remain subject to their respective licenses. Third-party and previously granted licenses remain in force. Users retain their rights in their own generated outputs.';

export const proprietarySoftwareShortNotice =
  'AYATRISYA is a product of AMETESX. Original material is proprietary; third-party and prior licenses remain in force.';

export const ownershipScopeStatement =
  'Subject to applicable law and third-party rights, Ametesx claims ownership of its original product identity, logos, proprietary source code, original UI/UX designs, product documentation, website content, and architecture. Open-source components and user-generated outputs are explicitly excluded from Ametesx ownership claims.';

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

export const brandUseStatement =
  'The Ametesx and Ayatrisya names and logos identify Ametesx and its product. Do not use these identifiers in a way that suggests affiliation, sponsorship, or endorsement without permission from the applicable rights holder. No trademark registration claim is made here.';

export const thirdPartyIntellectualPropertyStatement =
  'Third-party dependencies, pretrained models, datasets, fonts, icons, libraries, rules, and externally generated assets remain subject to their respective owners and license terms. Ametesx does not claim third-party ownership merely because material is used, integrated, hosted, or distributed with an Ametesx product.';

export const rightsContactStatus =
  'For copyright and IP enquiries, contact Ametesx at ametesxtech@gmail.com.';
