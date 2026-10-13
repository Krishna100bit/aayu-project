import type { Level } from "./levels";
import { bumpLevel } from "./levels";
import type { ClinicalRule, RuleSetDefinition, TriageInput } from "./types";

export interface ModifierResult {
  modifiedLevel: Level;
  firedModifiers: string[];
}

function hasConditionKey(cond: unknown, key: string): boolean {
  if (!cond || typeof cond !== "object") return false;
  if (key in cond) return true;
  if ("all" in cond && Array.isArray((cond as { all: unknown[] }).all)) {
    return (cond as { all: unknown[] }).all.some((c) => hasConditionKey(c, key));
  }
  if ("any" in cond && Array.isArray((cond as { any: unknown[] }).any)) {
    return (cond as { any: unknown[] }).any.some((c) => hasConditionKey(c, key));
  }
  return false;
}

export function evaluateModifiers(
  currentLevel: Level | null,
  firedRules: ClinicalRule[],
  input: TriageInput,
  ruleDef: RuleSetDefinition,
): ModifierResult {
  if (!currentLevel) {
    return { modifiedLevel: "ROUTINE", firedModifiers: [] };
  }

  const firedModifiers: string[] = [];
  let shouldBump = false;

  const neverRules = ruleDef.modifiers.never_applies_to_rules;
  const nonRoutineRulesFired = firedRules.filter((r) => !neverRules.includes(r.id));
  const hasEligibleFiredRule = nonRoutineRulesFired.length > 0;

  // Revisit modifier (72h): applies when any symptom rule fired (including Q01)
  if (input.is_revisit_72h && firedRules.length > 0) {
    shouldBump = true;
    firedModifiers.push("MOD-REVISIT-72H");
  }

  // Demographic / comorbidity modifiers apply only if a non-Q01/Q02 rule fired
  if (hasEligibleFiredRule) {
    for (const mod of ruleDef.modifiers.bump_one_level_if_any) {
      if (mod.age_gt !== undefined && input.age_years > mod.age_gt) {
        shouldBump = true;
        firedModifiers.push("MOD-AGE-ELDERLY");
      }

      if (mod.age_lt_years !== undefined) {
        const effectiveAge = input.age_months !== undefined ? input.age_months / 12 : input.age_years;
        if (effectiveAge < mod.age_lt_years) {
          // If a fired rule already directly evaluated age_lt_years (e.g. S07), do not double-penalize
          const ruleAlreadyAccountsForChildAge = nonRoutineRulesFired.some((r) =>
            hasConditionKey(r.when, "age_lt_years"),
          );
          if (!ruleAlreadyAccountsForChildAge) {
            shouldBump = true;
            firedModifiers.push("MOD-AGE-CHILD");
          }
        }
      }

      if (mod.pregnant && input.pregnant) {
        // If a fired rule already accounts for pregnancy (e.g. R08), don't double bump
        const ruleAlreadyAccountsForPregnancy = nonRoutineRulesFired.some((r) =>
          hasConditionKey(r.when, "pregnant"),
        );
        if (!ruleAlreadyAccountsForPregnancy) {
          shouldBump = true;
          firedModifiers.push("MOD-PREGNANT");
        }
      }

      if (mod.cond_any && mod.cond_any.length > 0) {
        const matchedCond = input.conditions.find((c) => mod.cond_any?.includes(c));
        if (matchedCond) {
          shouldBump = true;
          firedModifiers.push(`MOD-COND-${matchedCond.toUpperCase()}`);
        }
      }
    }
  }

  const modifiedLevel = shouldBump ? bumpLevel(currentLevel) : currentLevel;

  return {
    modifiedLevel,
    firedModifiers,
  };
}
