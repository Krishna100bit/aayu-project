import { describe, it, expect } from "vitest";
import ruleData from "@data/rules.json";
import symptomData from "@data/symptoms.json";
import * as EngineBarrel from "@/engine";
import {
  isLevel,
  evaluate,
  validateVitalsPlausibility,
  evaluateVitals,
  matchKeywords,
  normalizeText,
  formatReason,
  hasRedFlagRule,
  areBasicVitalsMissing,
  evaluateCondition,
  evaluateModifiers,
  type RuleSetDefinition,
  type ClinicalRule,
  type RuleDslCondition,
  type TriageInput,
} from "@/engine";

const rules = ruleData as unknown as RuleSetDefinition;

describe("Engine Coverage Booster (Edge cases & branches)", () => {
  it("covers index barrel exports and isLevel", () => {
    expect(EngineBarrel.LEVELS).toBeDefined();
    expect(isLevel("IMMEDIATE")).toBe(true);
    expect(isLevel("INVALID")).toBe(false);
    expect(isLevel(123)).toBe(false);
  });

  it("covers all vitals plausibility branches", () => {
    expect(validateVitalsPlausibility(undefined)).toEqual([]);
    expect(validateVitalsPlausibility({ spo2: 20 })).toHaveLength(1);
    expect(validateVitalsPlausibility({ hr: -5 })).toHaveLength(1);
    expect(validateVitalsPlausibility({ hr: 350 })).toHaveLength(1);
    expect(validateVitalsPlausibility({ sbp: 10 })).toHaveLength(1);
    expect(validateVitalsPlausibility({ sbp: 350 })).toHaveLength(1);
    expect(validateVitalsPlausibility({ dbp: 5 })).toHaveLength(1);
    expect(validateVitalsPlausibility({ dbp: 250 })).toHaveLength(1);
    expect(validateVitalsPlausibility({ rr: -1 })).toHaveLength(1);
    expect(validateVitalsPlausibility({ rr: 120 })).toHaveLength(1);
    expect(validateVitalsPlausibility({ temp_c: 20 })).toHaveLength(1);
    expect(validateVitalsPlausibility({ temp_c: 48 })).toHaveLength(1);
    expect(validateVitalsPlausibility({ glucose_mgdl: -10 })).toHaveLength(1);
    expect(validateVitalsPlausibility({ glucose_mgdl: 2000 })).toHaveLength(1);
  });

  it("covers implausible vitals in evaluateVitals and child emergency vitals", () => {
    const impRes = evaluateVitals({ spo2: 150 }, { age_years: 30, tags: [] }, rules);
    expect(impRes.tasks).toContain("remeasure_spo2");

    const childLowSpo2 = evaluateVitals({ spo2: 90 }, { age_years: 3, tags: [] }, rules);
    expect(childLowSpo2.level).toBe("IMMEDIATE");

    const childDrowsy = evaluateVitals({ consciousness: "confused" }, { age_years: 3, tags: [] }, rules);
    expect(childDrowsy.level).toBe("IMMEDIATE");

    const bpRedFlag = evaluateVitals(
      { sbp: 190 },
      { age_years: 45, tags: ["chest_pain"] },
      rules,
    );
    expect(bpRedFlag.level).toBe("IMMEDIATE");
  });

  it("covers all intermediate NEWS2 scoring bands", () => {
    const rr1 = evaluateVitals({ rr: 10 }, { age_years: 30, tags: [] }, rules);
    expect(rr1.flags.some((f) => f.param === "rr" && f.score === 1)).toBe(true);

    const rr2 = evaluateVitals({ rr: 22 }, { age_years: 30, tags: [] }, rules);
    expect(rr2.flags.some((f) => f.param === "rr" && f.score === 2)).toBe(true);

    const spo2_1 = evaluateVitals({ spo2: 95 }, { age_years: 30, tags: [] }, rules);
    expect(spo2_1.flags.some((f) => f.param === "spo2" && f.score === 1)).toBe(true);

    const sbp2 = evaluateVitals({ sbp: 95 }, { age_years: 30, tags: [] }, rules);
    expect(sbp2.flags.some((f) => f.param === "sbp" && f.score === 2)).toBe(true);

    const sbp1 = evaluateVitals({ sbp: 105 }, { age_years: 30, tags: [] }, rules);
    expect(sbp1.flags.some((f) => f.param === "sbp" && f.score === 1)).toBe(true);

    const sbp3 = evaluateVitals({ sbp: 230 }, { age_years: 30, tags: [] }, rules);
    expect(sbp3.flags.some((f) => f.param === "sbp" && f.score === 3)).toBe(true);

    const hr1 = evaluateVitals({ hr: 48 }, { age_years: 30, tags: [] }, rules);
    expect(hr1.flags.some((f) => f.param === "hr" && f.score === 1)).toBe(true);

    const hr1b = evaluateVitals({ hr: 100 }, { age_years: 30, tags: [] }, rules);
    expect(hr1b.flags.some((f) => f.param === "hr" && f.score === 1)).toBe(true);

    const hr2 = evaluateVitals({ hr: 120 }, { age_years: 30, tags: [] }, rules);
    expect(hr2.flags.some((f) => f.param === "hr" && f.score === 2)).toBe(true);

    const temp1 = evaluateVitals({ temp_c: 35.5 }, { age_years: 30, tags: [] }, rules);
    expect(temp1.flags.some((f) => f.param === "temp_c" && f.score === 1)).toBe(true);

    const temp1b = evaluateVitals({ temp_c: 38.6 }, { age_years: 30, tags: [] }, rules);
    expect(temp1b.flags.some((f) => f.param === "temp_c" && f.score === 1)).toBe(true);
  });

  it("covers vitals extra branches: DBP >= 120 and pregnancy DBP >= 110", () => {
    const highDbp = evaluate(
      {
        age_years: 45,
        sex: "M",
        tags: [],
        conditions: [],
        vitals: { sbp: 150, dbp: 125, hr: 80, spo2: 98, rr: 16 },
      },
      rules,
    );
    expect(highDbp.fired_rules).toContain("V-BP-HIGH");

    const pregHighDbp = evaluate(
      {
        age_years: 28,
        sex: "F",
        pregnant: true,
        tags: [],
        conditions: [],
        vitals: { sbp: 140, dbp: 115, hr: 80, spo2: 98, rr: 16 },
      },
      rules,
    );
    expect(pregHighDbp.fired_rules).toContain("V-BP-PREG");
    expect(pregHighDbp.level).toBe("IMMEDIATE");
  });

  it("covers hypoglycemia V-GLU-LOW extra rule", () => {
    const hypoRes = evaluate(
      {
        age_years: 50,
        sex: "M",
        tags: ["sweating"],
        conditions: ["diabetes"],
        vitals: { glucose_mgdl: 55, hr: 90, sbp: 120, spo2: 98, rr: 16 },
      },
      rules,
    );
    expect(hypoRes.fired_rules).toContain("V-GLU-LOW");
    expect(hypoRes.level).toBe("IMMEDIATE");
  });

  it("covers adult NEWS2 bands: temperature and heart rate scores", () => {
    const hypothermia = evaluate(
      {
        age_years: 40,
        sex: "M",
        tags: [],
        conditions: [],
        vitals: { temp_c: 34.5, hr: 60, sbp: 120, spo2: 98, rr: 16 },
      },
      rules,
    );
    expect(hypothermia.level).toBe("IMMEDIATE");

    const brady = evaluate(
      {
        age_years: 40,
        sex: "M",
        tags: [],
        conditions: [],
        vitals: { hr: 38, temp_c: 37.0, sbp: 120, spo2: 98, rr: 16 },
      },
      rules,
    );
    expect(brady.level).toBe("IMMEDIATE");

    const tachy = evaluate(
      {
        age_years: 40,
        sex: "M",
        tags: [],
        conditions: [],
        vitals: { hr: 140, temp_c: 37.0, sbp: 120, spo2: 98, rr: 16 },
      },
      rules,
    );
    expect(tachy.level).toBe("IMMEDIATE");
  });

  it("covers keyword matcher empty and unmatched text", () => {
    expect(matchKeywords("", symptomData.tiles)).toEqual({
      matchedTags: [],
      matchedPhrases: [],
      remainingText: "",
    });
    expect(normalizeText("")).toBe("");
    expect(formatReason("Hello {age}", 25)).toBe("Hello 25");
  });

  it("covers safety helpers", () => {
    expect(hasRedFlagRule([])).toBe(false);
    const mockRule: ClinicalRule = {
      id: "R01",
      level: "IMMEDIATE",
      when: { tag: "chest_pain" },
      reason_en: "test",
      reason_hi: "test",
    };
    expect(hasRedFlagRule([mockRule])).toBe(true);

    expect(
      areBasicVitalsMissing({
        age_years: 30,
        sex: "M",
        tags: [],
        conditions: [],
        vitals: { sbp: 120, hr: 80, spo2: 98 },
      }),
    ).toBe(false);
  });

  it("covers DSL condition fallbacks", () => {
    expect(evaluateCondition(null as unknown as RuleDslCondition, {} as unknown as TriageInput)).toBe(false);
    expect(evaluateCondition({ unknownKey: true } as unknown as RuleDslCondition, {} as unknown as TriageInput)).toBe(false);
  });

  it("covers modifier edge cases", () => {
    expect(
      evaluateModifiers(null, [], { age_years: 30, sex: "M", tags: [], conditions: [] }, rules),
    ).toEqual({ modifiedLevel: "ROUTINE", firedModifiers: [] });

    // Child rule already checking child age vs child with generic rule
    const mockChildRule: ClinicalRule = {
      id: "S07",
      level: "SOON",
      when: { age_lt_years: 5 },
      reason_en: "Child rule",
      reason_hi: "Child rule",
    };
    const modChild = evaluateModifiers(
      "SOON",
      [mockChildRule],
      { age_years: 2, sex: "M", tags: [], conditions: [] },
      rules,
    );
    expect(modChild.modifiedLevel).toBe("SOON");

    const mockGenericRule: ClinicalRule = {
      id: "S04",
      level: "SOON",
      when: { tag: "burning_urine" },
      reason_en: "Urine rule",
      reason_hi: "Urine rule",
    };
    const modChildGeneric = evaluateModifiers(
      "SOON",
      [mockGenericRule],
      { age_years: 2, sex: "M", tags: ["burning_urine"], conditions: [] },
      rules,
    );
    expect(modChildGeneric.firedModifiers).toContain("MOD-AGE-CHILD");
    expect(modChildGeneric.modifiedLevel).toBe("IMMEDIATE");

    // Pregnancy rule already checking pregnancy vs generic rule with pregnancy
    const mockPregRule: ClinicalRule = {
      id: "R08",
      level: "IMMEDIATE",
      when: { pregnant: true },
      reason_en: "Preg rule",
      reason_hi: "Preg rule",
    };
    const modPreg = evaluateModifiers(
      "IMMEDIATE",
      [mockPregRule],
      { age_years: 25, sex: "F", pregnant: true, tags: [], conditions: [] },
      rules,
    );
    expect(modPreg.modifiedLevel).toBe("IMMEDIATE");

    const modPregGeneric = evaluateModifiers(
      "SOON",
      [mockGenericRule],
      { age_years: 25, sex: "F", pregnant: true, tags: ["burning_urine"], conditions: [] },
      rules,
    );
    expect(modPregGeneric.firedModifiers).toContain("MOD-PREGNANT");
    expect(modPregGeneric.modifiedLevel).toBe("IMMEDIATE");
  });

  it("covers child vitals fever & hypothermia", () => {
    const childLowTemp = evaluateVitals(
      { temp_c: 35.5 },
      { age_years: 4, tags: [] },
      rules,
    );
    expect(childLowTemp.level).toBe("SOON");

    const childHighTemp = evaluateVitals(
      { temp_c: 39.0 },
      { age_years: 4, tags: [] },
      rules,
    );
    expect(childHighTemp.level).toBe("SOON");

    const childMildSpo2 = evaluateVitals(
      { spo2: 94 },
      { age_years: 4, tags: [] },
      rules,
    );
    expect(childMildSpo2.level).toBe("SOON");
  });

  it("covers evaluate reason fallbacks and safety tag_sources", () => {
    const emptyRes = evaluate(
      {
        age_years: 25,
        sex: "M",
        tags: [],
        conditions: [],
      },
      rules,
    );
    expect(emptyRes.reason_en).toContain("Routine visit");

    const unmatchedRes = evaluate(
      {
        age_years: 25,
        sex: "M",
        tags: [],
        unmatched_text: true,
        conditions: [],
      },
      rules,
    );
    expect(unmatchedRes.reason_en).toContain("Unusual symptom");

    const llmSourceRes = evaluate(
      {
        age_years: 25,
        sex: "M",
        tags: ["cough_cold"],
        tag_sources: { cough_cold: "llm" },
        conditions: [],
      },
      rules,
    );
    expect(llmSourceRes.needs_verification).toBe(true);

    const pregDeptRes = evaluate(
      {
        age_years: 25,
        sex: "F",
        pregnant: true,
        tags: ["cough_cold"],
        conditions: [],
      },
      rules,
    );
    expect(pregDeptRes.dept_hint).toBe("OBG");

    // Pure catalogue synonym matching in matchKeywords
    const kwCat = matchKeywords("seena bhaari", symptomData.tiles);
    expect(kwCat.matchedTags).toContain("chest_pain");
  });
});
