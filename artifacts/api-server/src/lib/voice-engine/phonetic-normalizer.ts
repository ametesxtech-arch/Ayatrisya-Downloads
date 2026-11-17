/**
 * Phonetic Normalizer for Multilingual Speech Synthesis (English, Hindi, Odia, Indian context)
 * Normalizes technical terms, acronyms, math symbols, currency, and regional names.
 */

const PHONETIC_DICTIONARY: Record<string, string> = {
  ayatrisya: "Aaya-tree-sha",
  bhubaneswar: "Bhooba-nesh-war",
  odisha: "Odi-sha",
  namaste: "Na-mas-tay",
  dhanyavad: "Dhan-ya-vaad",
  apana: "Aapa-na",
  kemiti: "Kay-mee-tee",
  achhanti: "Achh-an-tee",
  namaskar: "Na-mas-kaar",
};

const ACRONYM_MAP: Record<string, string> = {
  api: "A P I",
  ai: "A I",
  ui: "U I",
  ux: "U X",
  cli: "C L I",
  sql: "S Q L",
  http: "H T T P",
  https: "H T T P S",
  sdk: "S D K",
  rest: "REST",
  json: "JAY-sawn",
  xml: "X M L",
  html: "H T M L",
  css: "C S S",
  pptx: "P P T X",
  pdf: "P D F",
  sha256: "S H A 256",
  jwt: "J O T",
};

export function normalizePhoneticsForSpeech(rawText: string): string {
  if (!rawText) return "";

  let text = rawText;

  // 1. Currency normalization
  text = text.replace(/₹\s*([0-9,.]+)/g, "$1 rupees");
  text = text.replace(/\$\s*([0-9,.]+)/g, "$1 dollars");
  text = text.replace(/€\s*([0-9,.]+)/g, "$1 euros");
  text = text.replace(/£\s*([0-9,.]+)/g, "$1 pounds");

  // 2. Symbols & Math
  text = text.replace(/%/g, " percent ");
  text = text.replace(/\+/g, " plus ");
  text = text.replace(/=/g, " equals ");
  text = text.replace(/\s*->\s*/g, " leads to ");
  text = text.replace(/\s*=>\s*/g, " yields ");

  // 3. Units & Indian numerics
  text = text.replace(/\b([0-9]+)\s*lakh\b/gi, "$1 lakh");
  text = text.replace(/\b([0-9]+)\s*cr\b/gi, "$1 crore");
  text = text.replace(/\b([0-9]+)\s*gb\b/gi, "$1 gigabytes");
  text = text.replace(/\b([0-9]+)\s*mb\b/gi, "$1 megabytes");
  text = text.replace(/\b([0-9]+)\s*ms\b/gi, "$1 milliseconds");

  // 4. Acronym expansion
  text = text.replace(/\b[A-Za-z]+\b/g, (word) => {
    const lower = word.toLowerCase();
    if (PHONETIC_DICTIONARY[lower]) {
      return PHONETIC_DICTIONARY[lower];
    }
    if (ACRONYM_MAP[lower]) {
      return ACRONYM_MAP[lower];
    }
    return word;
  });

  // Clean extra whitespace
  return text.replace(/\s+/g, " ").trim();
}

