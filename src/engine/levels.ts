/**
 * Triage levels. Pure module (no framework imports) shared by the engine and the UI.
 */
export const LEVELS = ["IMMEDIATE", "SOON", "ROUTINE"] as const;
export type Level = (typeof LEVELS)[number];

/** Lower rank = more urgent. Matches level_rank in db v_queue. */
export const LEVEL_RANK: Record<Level, 1 | 2 | 3> = { IMMEDIATE: 1, SOON: 2, ROUTINE: 3 };

export function isLevel(v: unknown): v is Level {
  return typeof v === "string" && (LEVELS as readonly string[]).includes(v);
}

/** The more urgent of two levels (S-1: highest wins, never averaged). */
export function maxLevel(a: Level, b: Level): Level {
  return LEVEL_RANK[a] <= LEVEL_RANK[b] ? a : b;
}

/** Raise one level, capped at IMMEDIATE. */
export function bumpLevel(l: Level): Level {
  return l === "ROUTINE" ? "SOON" : "IMMEDIATE";
}
