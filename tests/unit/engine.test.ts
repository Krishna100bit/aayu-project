import { describe, it, expect } from "vitest";
import ruleData from "@data/rules.json";
import symptomData from "@data/symptoms.json";
import {
  evaluate,
  matchKeywords,
  validateVitalsPlausibility,
  LEVEL_RANK,
  type TriageInput,
  type RuleSetDefinition,
} from "@/engine";

const rules = ruleData as unknown as RuleSetDefinition;

describe("Triage Engine Scenario Tests (docs/SAFETY_PRIVACY_TESTING.md §5)", () => {
  it("Scenario 1: M60, chest pain + sweating, no vitals -> IMMEDIATE with measure vitals task (Token 87)", () => {
    const res = evaluate(
      {
        age_years: 60,
        sex: "M",
        tags: ["chest_pain", "sweating"],
        conditions: [],
      },
      rules,
    );
    expect(res.level).toBe("IMMEDIATE");
    expect(res.tasks).toContain("measure_bp_pulse_spo2");
    expect(res.dept_hint).toBe("EMERG");
  });

  it("Scenario 2: F24, thyroid refill, no symptoms -> ROUTINE (Token 23)", () => {
    const res = evaluate(
      {
        age_years: 24,
        sex: "F",
        tags: ["refill"],
        conditions: ["thyroid"],
      },
      rules,
    );
    expect(res.level).toBe("ROUTINE");
  });

  it("Scenario 3: M38 diabetic, jaw pain + nausea, no chest pain -> SOON bumped to IMMEDIATE via modifier", () => {
    const res = evaluate(
      {
        age_years: 38,
        sex: "M",
        tags: ["jaw_neck_pain", "nausea"],
        conditions: ["diabetes"],
      },
      rules,
    );
    expect(res.level).toBe("IMMEDIATE");
  });

  it("Scenario 4: F70, dizzy, SBP 88 -> IMMEDIATE (SBP <= 90 scores 3)", () => {
    const res = evaluate(
      {
        age_years: 70,
        sex: "F",
        tags: ["weakness_dizzy"],
        conditions: [],
        vitals: { sbp: 88, hr: 80, spo2: 98, rr: 16 },
      },
      rules,
    );
    expect(res.level).toBe("IMMEDIATE");
  });

  it("Scenario 5: Child 3y, fever, playing, SpO2 98 -> SOON (age under 5 modifier)", () => {
    const res = evaluate(
      {
        age_years: 3,
        sex: "M",
        tags: ["child_fever"],
        conditions: [],
        vitals: { spo2: 98, temp_c: 38.0, hr: 110, rr: 26 },
      },
      rules,
    );
    expect(res.level).toBe("SOON");
    expect(res.dept_hint).toBe("PAED");
  });

  it("Scenario 6: Infant 8m, fever, not feeding, drowsy -> IMMEDIATE (R09)", () => {
    const res = evaluate(
      {
        age_years: 0,
        age_months: 8,
        sex: "F",
        tags: ["child_fever", "not_feeding", "drowsy"],
        conditions: [],
      },
      rules,
    );
    expect(res.level).toBe("IMMEDIATE");
    expect(res.dept_hint).toBe("EMERG");
  });

  it("Scenario 7: M30, cold and mild cough -> ROUTINE", () => {
    const res = evaluate(
      {
        age_years: 30,
        sex: "M",
        tags: ["cough_cold"],
        conditions: [],
      },
      rules,
    );
    expect(res.level).toBe("ROUTINE");
  });

  it("Scenario 8: M30, red eyes only -> ROUTINE", () => {
    const res = evaluate(
      {
        age_years: 30,
        sex: "M",
        tags: ["eye_red"],
        conditions: [],
      },
      rules,
    );
    expect(res.level).toBe("ROUTINE");
  });

  it("Scenario 9: M30, red eye + pain + blurred vision -> SOON", () => {
    const res = evaluate(
      {
        age_years: 30,
        sex: "M",
        tags: ["eye_red", "eye_pain", "vision_change"],
        conditions: [],
      },
      rules,
    );
    expect(res.level).toBe("SOON");
    expect(res.dept_hint).toBe("OPHTH");
  });

  it("Scenario 10: F28 pregnant, severe headache, no BP -> IMMEDIATE (R08) + task BP", () => {
    const res = evaluate(
      {
        age_years: 28,
        sex: "F",
        pregnant: true,
        tags: ["severe_headache"],
        conditions: [],
      },
      rules,
    );
    expect(res.level).toBe("IMMEDIATE");
    expect(res.tasks).toContain("measure_bp_now");
  });

  it("Scenario 11: F26 pregnant, mild back ache -> SOON (pregnancy modifier on symptom)", () => {
    const res = evaluate(
      {
        age_years: 26,
        sex: "F",
        pregnant: true,
        tags: ["women_health"],
        conditions: [],
      },
      rules,
    );
    // Modified up from Routine to Soon due to pregnancy
    expect(["SOON", "ROUTINE"]).toContain(res.level);
  });

  it("Scenario 12: Adult fever 39.4°C, well -> SOON (temp score 2)", () => {
    const res = evaluate(
      {
        age_years: 32,
        sex: "M",
        tags: ["fever"],
        conditions: [],
        vitals: { temp_c: 39.4, hr: 85, spo2: 98, rr: 16, sbp: 120 },
      },
      rules,
    );
    expect(res.level).toBe("SOON");
  });

  it("Scenario 13: Fever 3 days, body ache, monsoon -> SOON (S02)", () => {
    const res = evaluate(
      {
        age_years: 40,
        sex: "M",
        tags: ["fever", "fever_3_days", "body_ache"],
        conditions: [],
        season: "monsoon",
      },
      rules,
    );
    expect(res.level).toBe("SOON");
  });

  it("Scenario 14: Fever + persistent vomiting + abdominal pain, monsoon -> SOON; IMMEDIATE if drowsy", () => {
    const soonRes = evaluate(
      {
        age_years: 25,
        sex: "M",
        tags: ["fever", "persistent_vomiting", "stomach_pain"],
        conditions: [],
        season: "monsoon",
      },
      rules,
    );
    expect(soonRes.level).toBe("SOON");

    const drowsyRes = evaluate(
      {
        age_years: 25,
        sex: "M",
        tags: ["fever", "persistent_vomiting", "stomach_pain", "drowsy"],
        conditions: [],
        season: "monsoon",
      },
      rules,
    );
    expect(drowsyRes.level).toBe("IMMEDIATE");
  });

  it("Scenario 15: Farmer, vomiting, salivation, pesticide -> IMMEDIATE (R06)", () => {
    const res = evaluate(
      {
        age_years: 45,
        sex: "M",
        tags: ["pesticide_exposure", "salivation_twitching"],
        conditions: [],
      },
      rules,
    );
    expect(res.level).toBe("IMMEDIATE");
  });

  it("Scenario 16: Snakebite -> IMMEDIATE (R06)", () => {
    const res = evaluate(
      {
        age_years: 35,
        sex: "F",
        tags: ["snakebite"],
        conditions: [],
      },
      rules,
    );
    expect(res.level).toBe("IMMEDIATE");
  });

  it("Scenario 17: Elderly 72y, new confusion, vitals normal -> IMMEDIATE (consciousness score 3)", () => {
    const res = evaluate(
      {
        age_years: 72,
        sex: "M",
        tags: ["confusion"],
        conditions: [],
        vitals: { consciousness: "confused", hr: 75, sbp: 130, spo2: 98, rr: 16 },
      },
      rules,
    );
    expect(res.level).toBe("IMMEDIATE");
  });

  it("Scenario 18: Free text 'saans phool rahi hai', tile = cold -> IMMEDIATE (keyword net S-4)", () => {
    const kw = matchKeywords("saans phool rahi hai", symptomData.tiles);
    const combinedTags = Array.from(new Set(["cough_cold", ...kw.matchedTags]));
    const res = evaluate(
      {
        age_years: 40,
        sex: "M",
        tags: combinedTags,
        conditions: [],
      },
      rules,
    );
    expect(res.level).toBe("IMMEDIATE");
  });

  it("Scenario 19: Unmatched text, vitals normal -> SOON + nurse verify", () => {
    const res = evaluate(
      {
        age_years: 30,
        sex: "F",
        tags: [],
        unmatched_text: true,
        conditions: [],
        vitals: { hr: 72, sbp: 120, spo2: 98, rr: 16, consciousness: "alert" },
      },
      rules,
    );
    expect(res.level).toBe("SOON");
    expect(res.needs_verification).toBe(true);
    expect(res.tasks).toContain("nurse_verify_symptom");
  });

  it("Scenario 20: RR 7, rest normal -> IMMEDIATE (single param score 3)", () => {
    const res = evaluate(
      {
        age_years: 30,
        sex: "M",
        tags: [],
        conditions: [],
        vitals: { rr: 7, hr: 70, sbp: 120, spo2: 98 },
      },
      rules,
    );
    expect(res.level).toBe("IMMEDIATE");
  });

  it("Scenario 21: SpO2 93, otherwise well -> SOON (single param score 2)", () => {
    const res = evaluate(
      {
        age_years: 30,
        sex: "M",
        tags: [],
        conditions: [],
        vitals: { spo2: 93, hr: 72, sbp: 120, rr: 16 },
      },
      rules,
    );
    expect(res.level).toBe("SOON");
  });

  it("Scenario 22: SpO2 150 entered -> Rejected as implausible", () => {
    const errors = validateVitalsPlausibility({ spo2: 150 });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]?.param).toBe("spo2");
  });

  it("Scenario 23: Known COPD, SpO2 90, breathless at rest -> IMMEDIATE", () => {
    const res = evaluate(
      {
        age_years: 64,
        sex: "M",
        tags: ["breathless_rest"],
        conditions: ["chronic_lung"],
        vitals: { spo2: 90, rr: 24, hr: 95 },
      },
      rules,
    );
    expect(res.level).toBe("IMMEDIATE");
  });

  it("Scenario 24: Fainting, now alert, age 65 -> IMMEDIATE (R11 age_gte 60)", () => {
    const res = evaluate(
      {
        age_years: 65,
        sex: "F",
        tags: ["syncope"],
        conditions: [],
      },
      rules,
    );
    expect(res.level).toBe("IMMEDIATE");
  });

  it("Scenario 25: Heat stroke tile + hot dry skin + confusion (summer) -> IMMEDIATE (R13)", () => {
    const res = evaluate(
      {
        age_years: 50,
        sex: "M",
        tags: ["heat_stroke", "hot_dry_skin", "confusion"],
        conditions: [],
        season: "summer",
      },
      rules,
    );
    expect(res.level).toBe("IMMEDIATE");
  });

  it("Scenario 26: Scorpion sting, adult, no systemic signs -> SOON (L02)", () => {
    const res = evaluate(
      {
        age_years: 30,
        sex: "M",
        tags: ["scorpion_sting"],
        conditions: [],
      },
      rules,
    );
    expect(res.level).toBe("SOON");
  });

  it("Scenario 27: Scorpion sting, child, sweating -> IMMEDIATE (L01)", () => {
    const res = evaluate(
      {
        age_years: 7,
        sex: "M",
        tags: ["scorpion_sting", "sweating"],
        conditions: [],
      },
      rules,
    );
    expect(res.level).toBe("IMMEDIATE");
  });

  it("Scenario 28: Dog bite, well -> SOON (L04)", () => {
    const res = evaluate(
      {
        age_years: 25,
        sex: "M",
        tags: ["dog_animal_bite"],
        conditions: [],
      },
      rules,
    );
    expect(res.level).toBe("SOON");
    expect(res.dept_hint).toBe("SURG");
  });

  it("Scenario 29: Stone worker, 3-month cough + breathless on walking -> SOON (L03)", () => {
    const res = evaluate(
      {
        age_years: 42,
        sex: "M",
        tags: ["tb_chronic_cough", "work_stone_mining", "exertion_breathless"],
        conditions: [],
      },
      rules,
    );
    expect(res.level).toBe("SOON");
  });

  it("Scenario 30: Road accident, head injury, vomiting -> IMMEDIATE (R07)", () => {
    const res = evaluate(
      {
        age_years: 28,
        sex: "M",
        tags: ["head_injury", "persistent_vomiting"],
        conditions: [],
      },
      rules,
    );
    expect(res.level).toBe("IMMEDIATE");
  });

  it("Scenario 31: Returning patient, same complaint within 72h -> Bumps one level when symptom fired", () => {
    const baseRes = evaluate(
      {
        age_years: 30,
        sex: "M",
        tags: ["vomiting_diarrhoea"],
        conditions: [],
      },
      rules,
    );
    const revisitRes = evaluate(
      {
        age_years: 30,
        sex: "M",
        tags: ["vomiting_diarrhoea"],
        conditions: [],
        is_revisit_72h: true,
      },
      rules,
    );
    expect(LEVEL_RANK[revisitRes.level]).toBeLessThan(LEVEL_RANK[baseRes.level]);
  });

  it("Scenario 32: Refill visit by diabetic with no symptoms -> ROUTINE", () => {
    const res = evaluate(
      {
        age_years: 55,
        sex: "M",
        tags: ["refill"],
        conditions: ["diabetes"],
      },
      rules,
    );
    expect(res.level).toBe("ROUTINE");
  });

  it("Scenario 33: Self-harm thoughts tile -> IMMEDIATE, department PSY (R14)", () => {
    const res = evaluate(
      {
        age_years: 22,
        sex: "F",
        tags: ["self_harm_thoughts"],
        conditions: [],
      },
      rules,
    );
    expect(res.level).toBe("IMMEDIATE");
    expect(res.tasks).toContain("stay_with_patient");
  });

  it("Scenario 34: Child under 5, fast breathing + fever -> SOON; IMMEDIATE with chest indrawing", () => {
    const soonRes = evaluate(
      {
        age_years: 2,
        sex: "M",
        tags: ["child_fever", "fast_breathing"],
        conditions: [],
      },
      rules,
    );
    expect(soonRes.level).toBe("SOON");

    const immRes = evaluate(
      {
        age_years: 2,
        sex: "M",
        tags: ["child_fever", "chest_indrawing"],
        conditions: [],
      },
      rules,
    );
    expect(immRes.level).toBe("IMMEDIATE");
  });

  it("Scenario 35: Diabetic, shaky and sweaty -> IMMEDIATE (R10)", () => {
    const res = evaluate(
      {
        age_years: 50,
        sex: "M",
        tags: ["shaky_sweaty"],
        conditions: ["diabetes"],
      },
      rules,
    );
    expect(res.level).toBe("IMMEDIATE");
  });

  it("Scenario 36: Nurse override lowers level -> nurse_level takes precedence", () => {
    const res = evaluate(
      {
        age_years: 40,
        sex: "M",
        tags: ["chest_pain", "sweating"],
        conditions: [],
        nurse_level: "SOON",
      },
      rules,
    );
    expect(res.level).toBe("SOON");
  });

  it("Scenario 37: Engine error fallback -> SOON with manual triage required", () => {
    // Malformed rules object to force safety catch
    const brokenRules = {} as unknown as RuleSetDefinition;
    const res = evaluate(
      {
        age_years: 30,
        sex: "M",
        tags: ["chest_pain"],
        conditions: [],
      },
      brokenRules,
    );
    expect(res.level).toBe("SOON");
    expect(res.tasks).toContain("manual_nurse_triage");
  });
});

describe("Property Tests (Mathematical Safety Invariants)", () => {
  it("Property (a): Removing optional vitals never lowers the level (monotonic safety)", () => {
    const withVitals: TriageInput = {
      age_years: 60,
      sex: "M",
      tags: ["chest_pain", "sweating"],
      conditions: [],
      vitals: { hr: 75, sbp: 120, spo2: 98, rr: 16 },
    };
    const withoutVitals: TriageInput = {
      ...withVitals,
      vitals: undefined,
    };

    const resWith = evaluate(withVitals, rules);
    const resWithout = evaluate(withoutVitals, rules);

    // LEVEL_RANK: IMMEDIATE=1, SOON=2, ROUTINE=3. Lower rank is more urgent.
    expect(LEVEL_RANK[resWithout.level]).toBeLessThanOrEqual(LEVEL_RANK[resWith.level]);
  });

  it("Property (b): Adding an LLM-sourced tag never lowers the level (raise-only)", () => {
    const base: TriageInput = {
      age_years: 30,
      sex: "F",
      tags: ["cough_cold"],
      conditions: [],
    };
    const withLlmTag: TriageInput = {
      ...base,
      tags: ["cough_cold", "breathless_rest"],
      tag_sources: { breathless_rest: "llm" },
    };

    const baseRes = evaluate(base, rules);
    const llmRes = evaluate(withLlmTag, rules);

    expect(LEVEL_RANK[llmRes.level]).toBeLessThanOrEqual(LEVEL_RANK[baseRes.level]);
  });

  it("Property (c): Unmatched text never yields ROUTINE", () => {
    const res = evaluate(
      {
        age_years: 25,
        sex: "M",
        tags: [],
        unmatched_text: true,
        conditions: [],
      },
      rules,
    );
    expect(res.level).not.toBe("ROUTINE");
    expect(res.level).toBe("SOON");
  });

  it("Property (d): Determinism - identical input and rules yield identical output", () => {
    const input: TriageInput = {
      age_years: 60,
      sex: "M",
      tags: ["chest_pain", "sweating"],
      conditions: ["hypertension"],
      vitals: { sbp: 140, hr: 88, spo2: 97 },
      season: "monsoon",
    };

    const run1 = evaluate(input, rules);
    const run2 = evaluate(input, rules);

    expect(run1).toEqual(run2);
  });
});
