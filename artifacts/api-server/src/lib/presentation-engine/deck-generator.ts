import { randomUUID } from "node:crypto";
import type {
  GenerateDeckRequest,
  PresentationDeck,
  PresentationSlide,
  SlideArchetype,
} from "./types";
import { getTheme } from "./theme-system";

export function generateStructuredDeck(req: GenerateDeckRequest): PresentationDeck {
  const { topic, slideCount = 6, theme: themeName, audience, style } = req;
  const theme = getTheme(themeName);
  const deckId = `deck-${randomUUID().slice(0, 8)}`;

  const archetypesCycle: SlideArchetype[] = [
    "title",
    "split_columns",
    "kpi_metrics",
    "timeline",
    "process",
    "comparison",
    "quote_callout",
    "takeaways",
  ];

  // Select diverse archetypes ensuring first is title and last is takeaways
  const chosenArchetypes: SlideArchetype[] = [];
  chosenArchetypes.push("title");

  const middleCount = Math.max(1, slideCount - 2);
  const middlePool = ["split_columns", "kpi_metrics", "timeline", "process", "comparison", "quote_callout"] as SlideArchetype[];

  for (let i = 0; i < middleCount; i++) {
    const archetype = middlePool[i % middlePool.length];
    chosenArchetypes.push(archetype);
  }

  chosenArchetypes.push("takeaways");

  // Construct slides
  const slides: PresentationSlide[] = chosenArchetypes.map((archetype, idx) => {
    const slideNumber = idx + 1;
    const slideId = `${deckId}-s${slideNumber}`;

    switch (archetype) {
      case "title":
        return {
          id: slideId,
          slideNumber,
          archetype: "title",
          title: topic,
          subtitle: `Strategic Analysis & Executive Roadmap • ${audience}`,
          editorialContent: `A comprehensive overview detailing the foundational paradigms, performance metrics, and tactical roadmap for ${topic}.`,
          speakerNotes: `Good morning, everyone. Today we are exploring ${topic}. Over the course of this presentation, we will walk through the core drivers, operational benchmarks, and long-term implications for our stakeholders.`,
          visualAsset: {
            type: "shape",
            caption: "Executive Presentation",
          },
        };

      case "split_columns":
        return {
          id: slideId,
          slideNumber,
          archetype: "split_columns",
          title: `Core Architectural Pillars`,
          subtitle: `Foundations of ${topic}`,
          editorialContent: `Three complementary dimensions underpin successful execution: resilience, developer velocity, and scalable governance.`,
          columns: [
            {
              title: "Autonomous Resilience",
              content: "Self-healing subsystems reduce manual operational overhead by over 70%.",
              bullets: ["Fault isolation boundaries", "Automated failover workflows"],
            },
            {
              title: "Deterministic Scale",
              content: "Horizontal elasticity that dynamically provisions capacity during peak spikes.",
              bullets: ["Sub-50ms latency profiles", "Predictive traffic scaling"],
            },
            {
              title: "Zero-Trust Security",
              content: "End-to-end cryptographic verifiability across every internal and external interaction.",
              bullets: ["Role-scoped token auth", "Continuous audit telemetry"],
            },
          ],
          speakerNotes: `Here we see the three foundational pillars. Rather than treating reliability and velocity as trade-offs, our architecture couples autonomous resilience with deterministic scale and zero-trust controls.`,
        };

      case "kpi_metrics":
        return {
          id: slideId,
          slideNumber,
          archetype: "kpi_metrics",
          title: `Empirical Performance Benchmarks`,
          subtitle: `Measured Impact & Velocity`,
          editorialContent: `Across empirical stress tests, our implementation demonstrates categorical efficiency gains across compute, memory, and throughput.`,
          metrics: [
            { label: "Efficiency Gain", value: "3.4x", badge: "Compute", delta: "+240%" },
            { label: "P99 Latency", value: "< 28ms", badge: "Verified", delta: "-82%" },
            { label: "Availability SLA", value: "99.99%", badge: "Enterprise", delta: "+0.09%" },
            { label: "Cost Reduction", value: "58%", badge: "TCO", delta: "-58%" },
          ],
          speakerNotes: `These figures represent audited benchmarks. Note the 3.4x compute efficiency lift alongside an 82% reduction in tail latency.`,
        };

      case "timeline":
        return {
          id: slideId,
          slideNumber,
          archetype: "timeline",
          title: `Implementation Roadmap & Milestones`,
          subtitle: `Execution Phases`,
          editorialContent: `A phased, risk-mitigated rollout structure spanning discovery, pilot validation, enterprise cutover, and autonomous optimization.`,
          timelineSteps: [
            { phase: "Q1", title: "Discovery & Baseline", description: "Audit legacy telemetry, define security perimeters, and establish golden metrics." },
            { phase: "Q2", title: "Pilot Deployment", description: "Deploy core pipelines to high-leverage beta workloads with real-time feedback loops." },
            { phase: "Q3", title: "Enterprise Cutover", description: "Zero-downtime migration across primary production clusters and data assets." },
            { phase: "Q4", title: "Autonomous Optimization", description: "Enable self-tuning heuristics and long-term continuous verification models." },
          ],
          speakerNotes: `Our roadmap is structured into four distinct quarterly horizons. Notice that Phase 1 prioritizes establishing golden baselines before deploying into live beta environments in Q2.`,
        };

      case "process":
        return {
          id: slideId,
          slideNumber,
          archetype: "process",
          title: `End-to-End Operational Workflow`,
          subtitle: `Data & Decision Pipeline`,
          editorialContent: `Every request traverses four deterministic verification gates before execution is committed.`,
          timelineSteps: [
            { phase: "Step 1", title: "Ingestion & Sanitization", description: "Input validation, payload normalization, and cryptographic verification." },
            { phase: "Step 2", title: "Intent Classification", description: "Machine-assisted routing based on semantic and operational requirements." },
            { phase: "Step 3", title: "Isolated Processing", description: "Sandboxed pipeline execution with bounded resource consumption." },
            { phase: "Step 4", title: "Verified Synthesis", description: "Schema-checked formatting and secure artifact generation." },
          ],
          speakerNotes: `Walking through the operational workflow: each step acts as a deterministic boundary, ensuring unvalidated inputs cannot breach backend processing pools.`,
        };

      case "comparison":
        return {
          id: slideId,
          slideNumber,
          archetype: "comparison",
          title: `Conventional vs. Modern Approach`,
          subtitle: `Comparative Matrix`,
          editorialContent: `Contrasting legacy synchronous architectures against modern asynchronous, streaming pipelines.`,
          comparison: {
            entityAName: "Legacy Systems",
            entityBName: "Modern Ayatrisya Architecture",
            criteria: [
              { criterion: "Scaling Model", entityA: "Monolithic & manual", entityB: "Elastic & autonomous" },
              { criterion: "Upload Handling", entityA: "In-memory buffers (OOM risk)", entityB: "Resumable chunked disk streams" },
              { criterion: "Response Latency", entityA: "Blocking wait for full response", entityB: "Streaming SSE with instant first-token" },
              { criterion: "Failure Recovery", entityA: "Cascading outages", entityB: "Automated multi-tier fallbacks" },
            ],
          },
          speakerNotes: `This comparison clearly articulates why legacy approaches struggle under high volume. The new architecture transitions from monolithic memory buffering to resilient chunked streaming.`,
        };

      case "quote_callout":
        return {
          id: slideId,
          slideNumber,
          archetype: "quote_callout",
          title: `Guiding Architectural Philosophy`,
          subtitle: `Core Conviction`,
          quote: {
            quoteText: "Resilience is not achieved by preventing all failures, but by designing architectures that degrade gracefully and recover autonomously.",
            attribution: "Ayatrisya Engineering Principles",
            role: "Core Architecture Manifesto",
          },
          editorialContent: `Our design philosophy anchors on transparency, verifiable guarantees, and strict resource safety boundaries.`,
          speakerNotes: `This quote captures the essence of our engineering philosophy. We build systems that expect real-world volatility and remain completely stable under pressure.`,
        };

      case "takeaways":
      default:
        return {
          id: slideId,
          slideNumber,
          archetype: "takeaways",
          title: `Strategic Takeaways & Next Steps`,
          subtitle: `Summary of Recommendations`,
          editorialContent: `Key conclusions drawn from our analysis and concrete action items for leadership.`,
          bullets: [
            "Modernize core processing pipelines to streaming and chunked models to eliminate memory ceilings.",
            "Enforce strict schema validation and error recovery on all structured user deliverables.",
            "Establish automated SLA monitoring and proactive circuit-breaker fallbacks across external integrations.",
            "Initiate immediate Phase 1 pilot to validate latency improvements with real production workloads.",
          ],
          speakerNotes: `In conclusion: the shift to streaming architectures and verified response protocols eliminates systemic bottlenecks. I welcome your questions and look forward to partnering on execution.`,
        };
    }
  });

  return {
    id: deckId,
    title: topic,
    subtitle: `Executive Presentation • ${audience}`,
    topic,
    audience,
    theme: theme.id,
    aspectRatio: "16:9",
    slides,
    totalSlides: slides.length,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

