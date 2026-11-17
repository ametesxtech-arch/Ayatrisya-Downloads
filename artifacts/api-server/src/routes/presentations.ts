import express, { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";
import { verifiedFirebaseUid } from "../lib/firebase-auth";
import { GenerateDeckRequestSchema } from "../lib/presentation-engine/types";
import { generateStructuredDeck } from "../lib/presentation-engine/deck-generator";
import { buildPptxBuffer } from "../lib/presentation-engine/pptx-builder";
import { THEME_PALETTES } from "../lib/presentation-engine/theme-system";

const router: IRouter = Router();

const authMessages = {
  missing: "Sign in to Ayatrisya to generate and export presentations.",
  unavailable: "Authentication service is temporarily unavailable.",
  invalid: "Your sign-in session expired. Sign in again and retry.",
};

// GET /api/presentations/themes - returns curated themes and contrast metrics (public metadata)
router.get("/presentations/themes", (_req: Request, res: Response) => {
  const themes = Object.values(THEME_PALETTES).map((t) => ({
    id: t.id,
    name: t.name,
    isDark: t.isDark,
    background: `#${t.background}`,
    surface: `#${t.surface}`,
    accent: `#${t.accent}`,
    textPrimary: `#${t.textPrimary}`,
    contrastRatio: `${t.contrastRatio}:1`,
    wcagRating: t.contrastRatio >= 7.0 ? "AAA" : t.contrastRatio >= 4.5 ? "AA" : "A",
  }));
  res.status(200).json({ themes });
});

// POST /api/presentations/generate - generates structured deck (authenticated)
router.post("/presentations/generate", async (req: Request, res: Response) => {
  const uid = await verifiedFirebaseUid(req, res, authMessages);
  if (!uid) return;

  const parsed = GenerateDeckRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid presentation request",
      details: parsed.error.issues.map((i) => i.message),
    });
    return;
  }

  const deck = generateStructuredDeck(parsed.data);
  res.status(200).json({
    success: true,
    deck,
  });
});

// POST /api/presentations/export-pptx - builds downloadable PPTX binary (authenticated)
router.post("/presentations/export-pptx", async (req: Request, res: Response) => {
  const uid = await verifiedFirebaseUid(req, res, authMessages);
  if (!uid) return;

  let deck = req.body?.deck;

  // If client passed generate parameters instead of full deck, generate it first
  if (!deck && req.body?.topic) {
    const parsed = GenerateDeckRequestSchema.safeParse(req.body);
    if (parsed.success) {
      deck = generateStructuredDeck(parsed.data);
    }
  }

  if (!deck || !Array.isArray(deck.slides) || deck.slides.length === 0) {
    res.status(400).json({
      error: "Invalid presentation deck. Must provide a valid deck with slides.",
    });
    return;
  }

  try {
    const pptxBuffer = buildPptxBuffer(deck);
    const sanitizedTitle = (deck.title || "presentation")
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "_")
      .slice(0, 40);

    res.set({
      "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "Content-Disposition": `attachment; filename="${sanitizedTitle}.pptx"`,
      "Content-Length": pptxBuffer.length.toString(),
      "Cache-Control": "no-store",
    });

    res.status(200).send(pptxBuffer);
  } catch (err: any) {
    res.status(500).json({
      error: "Failed to compile presentation into PPTX format",
      message: err?.message,
    });
  }
});

export default router;
