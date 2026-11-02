import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { fullProductPage, fullPrivacyPolicyPage, fullContactPage, fullLicensesPage, fullCookiesAndStoragePage } from '../data/legal-pages-full';
import { SHIPPED_DEPENDENCY_LICENSES } from '../data/licenses';
import { copyrightNotice, proprietarySoftwareNotice, ownershipScopeStatement } from '../data/copyright-policy';

describe('Ayatrisya Real Footer, Legal Pages & AMETESX Ownership System Suite', () => {
  // Test 1: Ownership definition strictly establishes Ametesx ownership while excluding open source and generated outputs
  it('correctly establishes Ametesx ownership without claiming open source or user outputs', () => {
    expect(proprietarySoftwareNotice).toContain('AYATRISYA is a product of AMETESX');
    expect(proprietarySoftwareNotice).toContain('Open-source components are not owned by Ametesx');
    expect(proprietarySoftwareNotice).toContain('Users retain their rights in their own generated outputs');
    expect(ownershipScopeStatement).toContain('Open-source components and user-generated outputs are explicitly excluded');

    const currentYear = new Date().getFullYear();
    expect(copyrightNotice('Ayatrisya')).toContain(`© ${currentYear} AMETESX · Ayatrisya. All rights reserved.`);
  });

  // Test 2: Product destination content
  it('verifies product page contains truthful features, models and technical limitations', () => {
    expect(fullProductPage.title).toContain('Product Architecture');
    const allText = fullProductPage.sections.map(s => `${s.heading} ${(s.paragraphs || []).join(' ')} ${(s.bullets || []).join(' ')}`).join(' ');
    expect(allText).toContain('local-first');
    expect(allText).toContain('Cloudflare Workers AI');
    expect(allText).toContain('Google Cloud Gemini');
    expect(allText).toContain('Replit-Style Canvas IDE');
    expect(allText).toContain('Gamma-Style Presentation Engine');
  });

  // Test 3: Privacy policy accurately describes local storage and external cloud requests
  it('verifies privacy policy accurately reflects local-first architecture and cloud processing boundaries', () => {
    expect(fullPrivacyPolicyPage.title).toBe('Privacy Policy');
    const allText = fullPrivacyPolicyPage.sections.map(s => `${s.heading} ${(s.paragraphs || []).join(' ')} ${(s.bullets || []).join(' ')}`).join(' ');
    expect(allText).toContain('IndexedDB');
    expect(allText).toContain('Firebase Authentication');
    expect(allText).toContain('Google Drive');
    expect(allText).toContain('ametesxtech@gmail.com');
  });

  // Test 4: Contact page provides verified contact channel without fake forms
  it('verifies contact page provides direct verified email channels without mock forms', () => {
    expect(fullContactPage.title).toBe('Contact & Support');
    const allText = fullContactPage.sections.map(s => `${s.heading} ${(s.paragraphs || []).join(' ')} ${(s.bullets || []).join(' ')}`).join(' ');
    expect(allText).toContain('ametesxtech@gmail.com');
    expect(allText).toContain('Responsible Disclosure Policy');
  });

  // Test 5: Open source licenses registry matches real shipped production dependencies
  it('verifies dependency license registry accurately inventories production packages', () => {
    expect(SHIPPED_DEPENDENCY_LICENSES.length).toBeGreaterThanOrEqual(15);
    const names = SHIPPED_DEPENDENCY_LICENSES.map(d => d.name);
    expect(names).toContain('react');
    expect(names).toContain('firebase');
    expect(names).toContain('idb');
    expect(names).toContain('lucide-react');
    expect(names).toContain('katex');
    expect(names).toContain('zod');
    expect(names).toContain('wouter');

    const licensePageText = fullLicensesPage.sections.map(s => `${s.heading} ${(s.paragraphs || []).join(' ')} ${(s.bullets || []).join(' ')}`).join(' ');
    expect(licensePageText).toContain('Lucide React');
    expect(licensePageText).toContain('KaTeX');
    expect(licensePageText).toContain('Apache-2.0');
    expect(licensePageText).toContain('MIT');
  });

  // Test 6: Cookies and storage accurately details client-side storage mechanisms
  it('verifies cookies and storage page reflects IndexedDB, localStorage and first-party cookies without ad trackers', () => {
    expect(fullCookiesAndStoragePage.title).toBe('Cookies & Storage Policy');
    const allText = fullCookiesAndStoragePage.sections.map(s => `${s.heading} ${(s.paragraphs || []).join(' ')} ${(s.bullets || []).join(' ')}`).join(' ');
    expect(allText).toContain('IndexedDB');
    expect(allText).toContain('localStorage');
    expect(allText).toContain('first-party cookies');
    expect(allText).not.toContain('advertising tracker');
  });
});

