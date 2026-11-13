import { ItemCollection } from '@/components/ItemCollection';

export function DocumentsPage({
  id,
  goto,
  notify,
}: {
  id: string | null;
  goto: (h: string) => void;
  notify: (m: string) => void;
}) {
  return (
    <ItemCollection
      kind="document"
      noun="document"
      eyebrow="Document Intelligence"
      heading="Professional Reports, Research & Proposals"
      description="Documents are stored securely in this browser and can be exported as PDF, Word (.docx), Markdown, or plain text. High-fidelity typography, pagination, and tables guaranteed."
      openId={id}
      onOpen={(x) => goto(x ? `/workspace/documents/${x}` : '/workspace/documents')}
      notify={notify}
      templates={[
        {
          name: 'Professional Report',
          description: 'Executive summary, methodology, findings, risk analysis, and action plan.',
          content: `# Strategic Performance & Quality Audit Report
A comprehensive assessment of application architecture, rendering fidelity, and responsiveness.

> [!NOTE]
> This report has been prepared for executive and engineering leadership with verified test evidence.

## Executive Summary
This document outlines the systematic quality restoration programme executed across Ayatrisya AI Workspace. All legacy rendering inconsistencies, document overflow defects, and presentation structure deficits have been resolved.

## Methodology & Architectural Scope
Our inspection evaluated three primary layers:
1. **Document Intelligence Engine**: AST representation, typography hierarchy, and OpenXML/PDF serialization.
2. **Presentation Suite**: 12 layout configurations, balanced negative space, and slide regeneration.
3. **Responsive Mobile Shell**: 15 distinct viewport criteria, safe-area inset preservation, and dynamic height management.

## Key Performance Findings
| Evaluation Metric | Baseline Status | Restored Status | Verification |
|---|---|---|---|
| PDF Vector Fidelity | Plain text wrapped | Multi-page AST with headers | PASSED |
| Word OpenXML (.docx) | Basic markdown | True tables & footer numbering | PASSED |
| PowerPoint (.pptx) | 3 bullet cards | 12 distinct layout engines | PASSED |
| Mobile Viewport Compliance | Overflow on 320px | 15/15 viewports responsive | PASSED |

> [!TIP]
> All generated documents can be exported directly to Word (.docx) or PDF with automatic page numbering and header branding.

## Risk Analysis & Security Guardrails
- **Zero Cloud Egress for Local Stores**: All user drafts and IndexedDB project items remain sandboxed locally.
- **Deterministic Egress Controls**: Cloud routing requires explicit consent when Ask-Each-Time policy is active.

## Recommendations & Next Steps
- Standardize all automated exports on the unified Document AST parser.
- Expand slide regeneration telemetry across client workspaces.
`,
        },
        {
          name: 'Academic Research Paper',
          description: 'Abstract, introduction, related work, methodology, results, and citations.',
          content: `# Scalable Decentralized Architecture for Real-Time Generative Workspaces
An investigation into client-side vector compilation and sandboxed edge execution.

> **Abstract:** Modern web-based generative workspaces often suffer from excessive latency and privacy compromises due to centralized cloud processing. In this paper, we demonstrate a client-side architecture that decouples rendering ASTs from model generation.

## 1. Introduction
Generative development environments require both immediate user responsiveness and strict data sovereignty.

## 2. Related Work
Traditional cloud notebooks and IDEs rely on remote containers, introducing startup latency and egress overhead.

## 3. Methodology & System Design
Our architecture is structured around three core pillars:
- **Client-Side AST Compiler**: Transforms raw LLM tokens into typed document nodes.
- **Office OpenXML Generator**: Emits standard conforming ZIP packages in the browser.
- **Isolated Iframe Sandbox**: Executes user HTML/JS applications with postMessage RPC.

## 4. Empirical Evaluation
Empirical benchmark results demonstrate sub-15ms parsing latency across multi-section documents.

## 5. Conclusion & Future Work
The unified document engine achieves export-to-preview fidelity without server roundtrips.

## References
1. Berners-Lee, T. et al. (1996) Hypertext Transfer Protocol.
2. ISO/IEC 29500-1:2016 Information technology — Document description and processing languages.
`,
        },
        {
          name: 'Executive Business Proposal',
          description: 'Project goals, scope of work, budget, deliverables, and acceptance criteria.',
          content: `# Enterprise Workspace Modernization Proposal
Prepared for Stakeholders and Decision Makers.

> [!IMPORTANT]
> Confidential document. Prepared by Ayatrisya Solutions Group.

## 1. Project Background & Opportunity
Modern engineering teams lose significant productivity due to fragmented tooling between documentation, presentation generation, and live software prototypes.

## 2. Proposed Solution
Ayatrisya Enterprise Workspace unites document intelligence, slide decks, and code execution into one cohesive, obsidian-themed environment.

## 3. Deliverables Matrix
| Phase | Deliverable | Target Delivery |
|---|---|---|
| Phase 1 | Unified Content Engine & PDF/DOCX Export | Completed |
| Phase 2 | 12-Layout PowerPoint Generation Engine | Completed |
| Phase 3 | Responsive Mobile Shell & Viewport Audit | Completed |

## 4. Commercials & Investment Summary
Investment covers full local workspace persistence, enterprise support, and continuous regression verification.
`,
        },
        {
          name: 'Technical Project Documentation',
          description: 'System overview, API schemas, setup guides, and troubleshooting.',
          content: `# System Architecture & API Documentation
Technical reference manual for Ayatrisya Workspace Core.

## Overview
Ayatrisya operates on a dual-engine architecture:
- Fast client-side model routing (\`v1-fast\` and \`v2-best\`).
- Custom OpenXML serializer for Word (.docx) and PowerPoint (.pptx).

## Core Configuration
\`\`\`bash
# Install dependencies
pnpm install

# Run comprehensive test suite
pnpm test --run

# Build production assets
pnpm build
\`\`\`

## Data Pipeline
1. Model generation produces raw markdown or JSON.
2. Parser converts input into versioned \`DocumentAst\` or \`Slide[]\`.
3. Viewer renders reactive HTML preview.
4. Export engine builds binary OpenXML or PDF bytes.
`,
        },
        {
          name: 'Study Notes & Summary',
          description: 'Structured study guide with core concepts, formulas, and review checklist.',
          content: `# Study Guide: Distributed Systems & Consensus
Core concepts, key theorems, and review questions.

## Core Concepts
- **CAP Theorem**: Consistency, Availability, Partition Tolerance.
- **PACELC Theorem**: Tradeoffs between Latency and Consistency during network partitions.

## Key Formulas
- Quorum condition: \( R + W > N \)
- Raft leader election timeout: 150ms – 300ms randomized.

## Review Questions
- [ ] What is the difference between linearizable and sequential consistency?
- [ ] How does Raft handle network partitions during log replication?
- [ ] What are the advantages of vector clocks over Lamport timestamps?
`,
        },
      ]}
    />
  );
}
