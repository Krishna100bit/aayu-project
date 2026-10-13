import rulesJson from "../../data/rules.json";
import { evaluate } from "./evaluate";
import type { RuleSetDefinition, TriageInput, TriageResult } from "./types";

const defaultRuleDef = rulesJson as unknown as RuleSetDefinition;

export function evaluatePatientTriage(input: TriageInput): TriageResult {
  return evaluate(input, defaultRuleDef);
}
