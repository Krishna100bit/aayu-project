import type { Level } from "./levels";
import { LEVEL_RANK, maxLevel } from "./levels";
import type { RuleSetDefinition, TriageInput, TriageResult } from "./types";
import { evaluateVitals } from "./vitals";
import { evaluateRules } from "./rules";
import { evaluateModifiers } from "./modifiers";
import { applySafetyLayer, createSafetyFallbackResult } from "./safety";

export function formatReason(template: string, age: number): string {
  return template.replace(/\{age\}/g, String(age));
}

export function evaluate(input: TriageInput, ruleDef: RuleSetDefinition): TriageResult {
  try {
    // 1. Layer 1: Vitals scoring
    const vitalsResult = evaluateVitals(
      input.vitals,
      {
        age_years: input.age_years,
        pregnant: input.pregnant,
        tags: input.tags,
      },
      ruleDef,
    );

    // 2. Layer 2: Rule DSL evaluation
    const { firedRules } = evaluateRules(ruleDef.rules, input);

    let symptomLevel: Level | null = null;
    if (firedRules.length > 0) {
      symptomLevel = firedRules.reduce<Level>((acc, rule) => {
        return maxLevel(acc, rule.level);
      }, "ROUTINE");
    }

    // 3. Layer 3: Modifiers evaluation
    const baseLevel = symptomLevel || vitalsResult.level || "ROUTINE";
    const { modifiedLevel, firedModifiers } = evaluateModifiers(
      baseLevel,
      firedRules,
      input,
      ruleDef,
    );

    // 4. Layer 4: Safety invariants (S-1 to S-8)
    const safetyResult = applySafetyLayer({
      vitalsLevel: vitalsResult.level,
      symptomLevel,
      modifiedLevel,
      firedRules,
      input,
      ruleVersion: ruleDef.version,
    });

    // 5. Gather tasks
    const allTasks = new Set<string>();
    vitalsResult.tasks.forEach((t) => allTasks.add(t));
    safetyResult.tasks.forEach((t) => allTasks.add(t));
    firedRules.forEach((r) => r.tasks?.forEach((t) => allTasks.add(t)));

    // 6. Gather fired rules IDs
    const allFiredIds: string[] = [
      ...firedRules.map((r) => r.id),
      ...vitalsResult.firedExtraRules,
      ...firedModifiers,
    ];

    // 7. Explanations in English and Hindi
    let reasonEn = "";
    let reasonHi = "";

    // Pick reason of the highest-urgency fired rule
    const highestFiredRule = [...firedRules].sort(
      (a, b) => LEVEL_RANK[a.level] - LEVEL_RANK[b.level],
    )[0];

    if (highestFiredRule) {
      reasonEn = formatReason(highestFiredRule.reason_en, input.age_years);
      reasonHi = formatReason(highestFiredRule.reason_hi, input.age_years);
    } else if (vitalsResult.level === "IMMEDIATE") {
      reasonEn = "Critical vital signs detected; immediate clinical attention required.";
      reasonHi = "गंभीर वाइटल्स संकेत मिले; तत्काल चिकित्सा जाँच आवश्यक।";
    } else if (vitalsResult.level === "SOON") {
      reasonEn = "Abnormal vital signs require timely clinical assessment.";
      reasonHi = "असामान्य वाइटल्स; समय पर जाँच आवश्यक।";
    } else if (input.unmatched_text) {
      reasonEn = "Unusual symptom not in the list; nurse to check and set priority.";
      reasonHi = "सूची में न मिलने वाला लक्षण; नर्स जाँचकर प्राथमिकता तय करेगी।";
    } else {
      reasonEn = "Routine visit; no red flag symptoms reported.";
      reasonHi = "नियमित आगमन; कोई खतरे के लक्षण नहीं।";
    }

    // If vital signs measurement task was added because vitals are missing on red flag:
    if (allTasks.has("measure_bp_pulse_spo2") && (!input.vitals || Object.keys(input.vitals).length === 0)) {
      reasonEn += " Vitals not recorded: measure BP, pulse and SpO2 now.";
      reasonHi += " वाइटल्स दर्ज नहीं: अभी BP, पल्स और SpO2 जाँचें।";
    }

    return {
      level: safetyResult.finalLevel,
      reason_en: reasonEn.trim(),
      reason_hi: reasonHi.trim(),
      fired_rules: allFiredIds,
      vitals_flags: vitalsResult.flags,
      tasks: Array.from(allTasks),
      dept_hint: safetyResult.deptHint,
      needs_verification: safetyResult.needsVerification,
      rule_version: ruleDef.version,
    };
  } catch {
    return createSafetyFallbackResult(ruleDef.version);
  }
}
