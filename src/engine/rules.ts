import type { ClinicalRule, RuleDslCondition, TriageInput } from "./types";

export function evaluateCondition(cond: RuleDslCondition, input: TriageInput): boolean {
  if (!cond || typeof cond !== "object") return false;

  if ("tag" in cond && typeof cond.tag === "string") {
    return input.tags.includes(cond.tag);
  }

  if ("all" in cond && Array.isArray(cond.all)) {
    return cond.all.every((c) => evaluateCondition(c, input));
  }

  if ("any" in cond && Array.isArray(cond.any)) {
    return cond.any.some((c) => evaluateCondition(c, input));
  }

  if ("age_gte" in cond && typeof cond.age_gte === "number") {
    return input.age_years >= cond.age_gte;
  }

  if ("age_gt" in cond && typeof cond.age_gt === "number") {
    return input.age_years > cond.age_gt;
  }

  if ("age_lt_years" in cond && typeof cond.age_lt_years === "number") {
    // If age_months is provided for infants (< 2y)
    const effectiveAge = input.age_months !== undefined ? input.age_months / 12 : input.age_years;
    return effectiveAge < cond.age_lt_years;
  }

  if ("pregnant" in cond && typeof cond.pregnant === "boolean") {
    return Boolean(input.pregnant) === cond.pregnant;
  }

  if ("cond" in cond && typeof cond.cond === "string") {
    return input.conditions.includes(cond.cond);
  }

  if ("season" in cond && typeof cond.season === "string") {
    return input.season === cond.season;
  }

  if ("unmatched_text" in cond && typeof cond.unmatched_text === "boolean") {
    return Boolean(input.unmatched_text) === cond.unmatched_text;
  }

  return false;
}

export interface RuleEvaluationResult {
  firedRules: ClinicalRule[];
}

export function evaluateRules(rules: ClinicalRule[], input: TriageInput): RuleEvaluationResult {
  const firedRules: ClinicalRule[] = [];

  for (const rule of rules) {
    if (evaluateCondition(rule.when, input)) {
      firedRules.push(rule);
    }
  }

  return { firedRules };
}
