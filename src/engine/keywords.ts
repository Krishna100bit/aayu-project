/**
 * Keyword safety-net matcher.
 * Normalizes Roman Hindi, Hinglish, and Devanagari text.
 * Scans for known symptom synonyms and red-flag phrases.
 */

export interface KeywordMatchResult {
  matchedTags: string[];
  matchedPhrases: string[];
  remainingText: string;
}

export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"'–—]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export interface SymptomCatalogueTile {
  id: string;
  synonyms?: string[];
  followups?: string[];
}

export function matchKeywords(
  text: string,
  tiles: SymptomCatalogueTile[],
): KeywordMatchResult {
  if (!text || text.trim() === "") {
    return { matchedTags: [], matchedPhrases: [], remainingText: "" };
  }

  let normalized = normalizeText(text);
  const matchedTags = new Set<string>();
  const matchedPhrases: string[] = [];

  // Special direct clinical phrase mappings for Hinglish & Hindi
  const specialPhrases: Array<{ phrase: string; tags: string[] }> = [
    { phrase: "saans phool rahi hai", tags: ["breathless", "breathless_rest"] },
    { phrase: "saans nahi aa rahi", tags: ["breathless", "breathless_rest"] },
    { phrase: "saas phool rahi", tags: ["breathless", "breathless_rest"] },
    { phrase: "dam ghut raha", tags: ["breathless", "breathless_rest"] },
    { phrase: "saans phoolna", tags: ["breathless", "breathless_rest"] },
    { phrase: "साँस फूल रही है", tags: ["breathless", "breathless_rest"] },
    { phrase: "seene mein dard", tags: ["chest_pain"] },
    { phrase: "chhati mein dard", tags: ["chest_pain"] },
    { phrase: "sar ghoom raha", tags: ["weakness_dizzy"] },
    { phrase: "chakkar aa rahe", tags: ["weakness_dizzy"] },
    { phrase: "khoon ki ulti", tags: ["vomiting_blood"] },
    { phrase: "behoshi", tags: ["syncope"] },
    { phrase: "pait mein dard", tags: ["stomach_pain"] },
  ];

  for (const item of specialPhrases) {
    if (normalized.includes(item.phrase)) {
      item.tags.forEach((t) => matchedTags.add(t));
      matchedPhrases.push(item.phrase);
      normalized = normalized.replace(item.phrase, " ").replace(/\s+/g, " ").trim();
    }
  }

  // Scan catalogue tile synonyms
  for (const tile of tiles) {
    if (!tile.synonyms) continue;
    for (const syn of tile.synonyms) {
      const normSyn = normalizeText(syn);
      if (normSyn.length > 2 && normalized.includes(normSyn)) {
        matchedTags.add(tile.id);
        matchedPhrases.push(syn);
        normalized = normalized.replace(normSyn, " ").replace(/\s+/g, " ").trim();
      }
    }
  }

  return {
    matchedTags: Array.from(matchedTags),
    matchedPhrases,
    remainingText: normalized,
  };
}
