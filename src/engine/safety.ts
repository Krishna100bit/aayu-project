import type { Level } from "./levels";
import { LEVEL_RANK, bumpLevel, maxLevel } from "./levels";
import type { ClinicalRule, TriageInput, TriageResult } from "./types";

/**
 * Checks if any fired rule is considered a red-flag rule (IMMEDIATE level).
 */
export function hasRedFlagRule(firedRules: ClinicalRule[]): boolean {
  return firedRules.some((r) => r.level === "IMMEDIATE");
}

/**
 * Checks if basic vitals (bp, pulse/hr, spo2) are missing.
 */
export function areBasicVitalsMissing(input: TriageInput): boolean {
  if (!input.vitals) return true;
  const { sbp, hr, spo2 } = input.vitals;
  return sbp === undefined || hr === undefined || spo2 === undefined;
}

/**
 * Applies the 8 core safety invariant layers (S-1 to S-8).
 */
export function applySafetyLayer(params: {
  vitalsLevel: Level | null;
  symptomLevel: Level | null;
  modifiedLevel: Level;
  firedRules: ClinicalRule[];
  input: TriageInput;
  ruleVersion: string;
}): {
  finalLevel: Level;
  tasks: string[];
  needsVerification: boolean;
  deptHint: string;
} {
  const { vitalsLevel, symptomLevel, modifiedLevel, firedRules, input } = params;
  const tasks: string[] = [];

  // S-1: Highest level wins across vitals, symptoms, and modifiers
  let candidateLevel: Level = "ROUTINE";
  if (vitalsLevel) candidateLevel = maxLevel(candidateLevel, vitalsLevel);
  if (symptomLevel) candidateLevel = maxLevel(candidateLevel, symptomLevel);
  candidateLevel = maxLevel(candidateLevel, modifiedLevel);

  // S-2: Red flag fired + vitals missing => bump one level + task to measure vitals
  const redFlagFired = hasRedFlagRule(firedRules);
  const vitalsMissing = areBasicVitalsMissing(input);

  if (redFlagFired && vitalsMissing) {
    candidateLevel = bumpLevel(candidateLevel);
    if (!tasks.includes("measure_bp_pulse_spo2")) {
      tasks.push("measure_bp_pulse_spo2");
    }
  }

  // S-3: Unmatched text never yields ROUTINE; defaults to at least SOON
  let needsVerification = Boolean(input.unmatched_text);
  if (input.tag_sources) {
    const hasLlmTag = Object.values(input.tag_sources).some((src) => src === "llm");
    if (hasLlmTag) needsVerification = true;
  }

  if (input.unmatched_text && LEVEL_RANK[candidateLevel] > LEVEL_RANK.SOON) {
    candidateLevel = "SOON";
    tasks.push("nurse_verify_symptom");
  }

  // S-7: If nurse_level is specified, human clinical decision wins over system recompute
  let finalLevel = candidateLevel;
  if (input.nurse_level) {
    finalLevel = input.nurse_level;
  }

  // Department hint routing
  let deptHint = "GEN_MED";

  // Check highest-priority fired rule's dept_hint
  const highestFired = [...firedRules].sort(
    (a, b) => LEVEL_RANK[a.level] - LEVEL_RANK[b.level],
  )[0];

  if (highestFired?.dept_hint) {
    deptHint = highestFired.dept_hint;
  }

  // Age < 12 and pregnant routing defaults
  if (input.age_years < 12 && deptHint === "GEN_MED") {
    deptHint = "PAED";
  } else if (input.pregnant && deptHint === "GEN_MED") {
    deptHint = "OBG";
  }

  // IMMEDIATE cases route to EMERG (Casualty)
  if (finalLevel === "IMMEDIATE") {
    deptHint = "EMERG";
  }

  return {
    finalLevel,
    tasks,
    needsVerification,
    deptHint,
  };
}

/**
 * Fallback result for engine errors (S-8 invariant: engine error => SOON with manual triage required)
 */
export function createSafetyFallbackResult(ruleVersion: string): TriageResult {
  return {
    level: "SOON",
    reason_en: "Engine exception encountered. Manual triage required.",
    reason_hi: "सिस्टम त्रुटि। नर्स द्वारा मैन्युअल ट्राइएज आवश्यक।",
    fired_rules: ["S-8-FALLBACK"],
    vitals_flags: [],
    tasks: ["manual_nurse_triage"],
    dept_hint: "GEN_MED",
    needs_verification: true,
    rule_version: ruleVersion,
  };
}
