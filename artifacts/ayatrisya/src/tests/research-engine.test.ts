import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeDeepResearch } from '@/ai/research-engine';
import { modelClient } from '@/ai/client';

describe('Ayatrisya Autonomous Research Engine', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('plans research, retrieves sources, evaluates contradictions, and produces a structured report with citations', async () => {
    let callCount = 0;
    vi.spyOn(modelClient, 'generateResponse').mockImplementation(async (messages) => {
      callCount++;
      const content = messages[0].content;
      if (content.includes('Decompose this research topic')) {
        return JSON.stringify({
          subQuestions: [
            'What are the primary cathode degradation mechanisms in solid-state batteries?',
            'What are the manufacturing yield bottlenecks for solid electrolyte interfaces?',
            'What is the commercialization timeline across major automotive OEMs?',
          ],
          searchQueries: [
            'solid state battery cathode degradation',
            'solid electrolyte interface manufacturing bottlenecks',
            'automotive solid state battery roadmap 2026',
          ],
        });
      }
      return JSON.stringify({
        summary: 'Solid-state batteries present significant energy density advantages over conventional lithium-ion, but face critical interfacial resistance and manufacturing scalability hurdles.',
        keyFindings: [
          'Lithium dendrite penetration remains an interfacial risk at high current densities.',
          'Sulfide-based electrolytes show superior ionic conductivity but require dry-room inert atmospheres.',
          'Initial pilot automotive vehicle integration is slated for 2027-2028.',
        ],
        contradictionsAndDebates: [
          'Oxide vs. Sulfide electrolyte trade-offs between mechanical stability and room-temperature conductivity.',
          'Discrepancies in cycle-life degradation rates under real-world ambient pressures.',
        ],
        detailedSections: [
          {
            title: 'Interfacial Resistance & Degradation',
            content: 'Mechanical stress during repeated charge cycles causes void formation at the lithium-solid electrolyte boundary [Source 1].',
          },
          {
            title: 'Industrial Manufacturing Yield',
            content: 'Transitioning from batch pressing to roll-to-roll calendering introduces microscopic defect propagation [Source 2].',
          },
          {
            title: 'Automotive OEM Milestones',
            content: 'Multiple global OEMs have completed A-sample cell evaluations with B-sample road testing underway [Source 3].',
          },
        ],
      });
    });

    const steps: string[] = [];
    const report = await executeDeepResearch('Solid-State Batteries', {
      saveToWorkspace: false,
      onProgress: (p) => steps.push(p.step),
    });

    expect(report.topic).toBe('Solid-State Batteries');
    expect(report.summary).toContain('Solid-state batteries present significant energy density');
    expect(report.keyFindings.length).toBe(3);
    expect(report.contradictionsAndDebates.length).toBe(2);
    expect(report.detailedSections.length).toBe(3);
    expect(report.sources.length).toBeGreaterThanOrEqual(3);
    expect(report.markdown).toContain('# Research Report: Solid-State Batteries');
    expect(report.markdown).toContain('## Key Findings');
    expect(report.markdown).toContain('## Contradictions, Open Questions & Active Debates');
    expect(report.markdown).toContain('## References & Verified Citations');
    expect(steps).toContain('planning');
    expect(steps).toContain('gathering');
    expect(steps).toContain('evaluating');
    expect(steps).toContain('synthesizing');
    expect(steps).toContain('completed');
  });
});

