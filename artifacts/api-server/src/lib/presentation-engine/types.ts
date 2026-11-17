import { z } from "zod";

export type SlideArchetype =
  | "title"
  | "section_header"
  | "split_columns"
  | "kpi_metrics"
  | "timeline"
  | "comparison"
  | "process"
  | "quote_callout"
  | "takeaways";

export interface ThemePalette {
  id: string;
  name: string;
  isDark: boolean;
  background: string;     // Hex e.g. "0F172A"
  surface: string;        // Hex e.g. "1E293B"
  textPrimary: string;    // Hex e.g. "F8FAFC"
  textSecondary: string;  // Hex e.g. "94A3B8"
  accent: string;         // Hex e.g. "10B981"
  highlight: string;      // Hex e.g. "38BDF8"
  headerFont: string;     // e.g. "Outfit", "Poppins"
  bodyFont: string;       // e.g. "Inter", "Roboto"
  contrastRatio: number;  // Evaluated WCAG contrast ratio e.g. 14.2
}

export interface MetricItem {
  label: string;
  value: string;
  badge?: string;
  delta?: string;
}

export interface ColumnItem {
  title: string;
  content: string;
  bullets?: string[];
  icon?: string;
}

export interface TimelineStep {
  phase: string;
  title: string;
  description: string;
  status?: string;
}

export interface ComparisonCriterion {
  criterion: string;
  entityA: string;
  entityB: string;
}

export interface PresentationSlide {
  id: string;
  slideNumber: number;
  archetype: SlideArchetype;
  title: string;
  subtitle?: string;
  editorialContent?: string;
  bullets?: string[]; // strictly 2-5 items
  metrics?: MetricItem[];
  columns?: ColumnItem[];
  timelineSteps?: TimelineStep[];
  comparison?: {
    entityAName: string;
    entityBName: string;
    criteria: ComparisonCriterion[];
  };
  quote?: {
    quoteText: string;
    attribution: string;
    role?: string;
  };
  speakerNotes: string;
  visualAsset?: {
    type: "image" | "shape" | "icon";
    url?: string;
    caption?: string;
    source?: string;
  };
}

export interface PresentationDeck {
  id: string;
  title: string;
  subtitle?: string;
  topic: string;
  audience?: string;
  theme: string;
  aspectRatio: "16:9";
  slides: PresentationSlide[];
  totalSlides: number;
  createdAt: string;
  updatedAt: string;
}

// Zod schemas for validation
export const GenerateDeckRequestSchema = z.object({
  topic: z.string().min(2, "Topic must be at least 2 characters"),
  slideCount: z.number().int().min(3).max(25).default(6),
  theme: z.string().optional().default("slate_emerald"),
  audience: z.string().optional().default("Executive & Professional"),
  style: z.enum(["editorial", "minimal", "bold", "technical"]).optional().default("editorial"),
});

export type GenerateDeckRequest = z.infer<typeof GenerateDeckRequestSchema>;

