import express, { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";
import { normalizePhoneticsForSpeech } from "../lib/voice-engine/phonetic-normalizer";
import { synthesizeEnhancedSpeechWav, type VoicePersona } from "../lib/voice-engine/voice-synthesizer";

const router: IRouter = Router();

const SynthesizeVoiceSchema = z.object({
  text: z.string().min(1, "Text is required for speech synthesis"),
  voice: z.enum(["ayatrisya-neural", "ayatrisya-professional", "ayatrisya-expressive"]).optional().default("ayatrisya-neural"),
  speed: z.number().min(0.5).max(2.0).optional().default(1.0),
  pitch: z.number().min(0.7).max(1.5).optional().default(1.0),
  phoneticPreprocess: z.boolean().optional().default(true),
});

// GET /api/voice/profiles
router.get("/voice/profiles", (_req: Request, res: Response) => {
  res.status(200).json({
    defaultProfile: "ayatrisya-neural",
    profiles: [
      {
        id: "ayatrisya-neural",
        name: "Ayatrisya Neural",
        gender: "female",
        pitchHz: 175,
        description: "Warm, articulate, balanced timbre designed for general assistance and conversational flow.",
      },
      {
        id: "ayatrisya-professional",
        name: "Ayatrisya Professional",
        gender: "male",
        pitchHz: 115,
        description: "Authoritative baritone timbre tailored for executive briefs, technical documentation, and code reviews.",
      },
      {
        id: "ayatrisya-expressive",
        name: "Ayatrisya Expressive",
        gender: "female",
        pitchHz: 190,
        description: "Bright, energetic cadence designed for learning, presentations, and engaging interactions.",
      },
    ],
    supportedLanguages: ["English (Global & Indian)", "Hindi", "Odia"],
    audioFormats: ["audio/wav (24kHz 16-bit PCM)", "audio/wav (16kHz 16-bit PCM)"],
  });
});

// POST /api/voice/normalize (preview phonetic transformation)
router.post("/voice/normalize", (req: Request, res: Response) => {
  const text = req.body?.text;
  if (!text || typeof text !== "string") {
    res.status(400).json({ error: "Text string is required" });
    return;
  }

  const normalized = normalizePhoneticsForSpeech(text);
  res.status(200).json({
    originalText: text,
    normalizedText: normalized,
  });
});

// POST /api/voice/synthesize
router.post("/voice/synthesize", (req: Request, res: Response) => {
  const parsed = SynthesizeVoiceSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid speech synthesis parameters",
      details: parsed.error.issues.map((i) => i.message),
    });
    return;
  }

  try {
    const wavBuffer = synthesizeEnhancedSpeechWav(parsed.data.text, {
      voice: parsed.data.voice as VoicePersona,
      speed: parsed.data.speed,
      pitch: parsed.data.pitch,
      phoneticPreprocess: parsed.data.phoneticPreprocess,
    });

    res.set({
      "Content-Type": "audio/wav",
      "Content-Length": wavBuffer.length.toString(),
      "Cache-Control": "no-store",
    });

    res.status(200).send(wavBuffer);
  } catch (err: any) {
    res.status(500).json({
      error: "Voice synthesis failed",
      message: err?.message,
    });
  }
});

export default router;
