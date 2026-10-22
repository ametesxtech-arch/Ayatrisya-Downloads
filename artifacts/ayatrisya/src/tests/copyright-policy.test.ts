import { describe, expect, it } from 'vitest';
import { proprietarySoftwareNotice, proprietarySoftwareShortNotice } from '../data/copyright-policy';

describe('proprietary software notice', () => {
  it('withholds public permission only for Ametesx-owned or authorized original material', () => {
    expect(proprietarySoftwareNotice).toContain('No public license is granted');
    expect(proprietarySoftwareNotice).toContain('Ametesx owns or is authorized to license');
  });

  it('preserves third-party and previously granted licenses', () => {
    expect(proprietarySoftwareNotice).toContain('Third-party and previously granted licenses remain in force.');
    expect(proprietarySoftwareShortNotice).toContain('third-party and prior licenses remain in force');
  });
});
