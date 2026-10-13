import type { Level } from "./levels";
import type { VitalsInput, VitalFlag, RuleSetDefinition } from "./types";

export interface VitalsEvalResult {
  level: Level | null;
  flags: VitalFlag[];
  totalScore: number;
  firedExtraRules: string[];
  tasks: string[];
  implausible: { param: string; message: string }[];
}

export function validateVitalsPlausibility(vitals?: VitalsInput): { param: string; message: string }[] {
  if (!vitals) return [];
  const errors: { param: string; message: string }[] = [];

  if (vitals.spo2 !== undefined && (vitals.spo2 > 100 || vitals.spo2 < 40)) {
    errors.push({ param: "spo2", message: "SpO2 must be between 40% and 100%. Re-measure." });
  }
  if (vitals.hr !== undefined && (vitals.hr <= 0 || vitals.hr > 300)) {
    errors.push({ param: "hr", message: "Pulse must be between 1 and 300 bpm. Re-measure." });
  }
  if (vitals.sbp !== undefined && (vitals.sbp <= 20 || vitals.sbp > 320)) {
    errors.push({ param: "sbp", message: "Systolic BP must be between 20 and 320 mmHg. Re-measure." });
  }
  if (vitals.dbp !== undefined && (vitals.dbp <= 10 || vitals.dbp > 220)) {
    errors.push({ param: "dbp", message: "Diastolic BP must be between 10 and 220 mmHg. Re-measure." });
  }
  if (vitals.rr !== undefined && (vitals.rr <= 0 || vitals.rr > 100)) {
    errors.push({ param: "rr", message: "Respiratory rate must be between 1 and 100/min. Re-measure." });
  }
  if (vitals.temp_c !== undefined && (vitals.temp_c < 25 || vitals.temp_c > 45)) {
    errors.push({ param: "temp_c", message: "Temperature must be between 25°C and 45°C. Re-measure." });
  }
  if (vitals.glucose_mgdl !== undefined && (vitals.glucose_mgdl <= 0 || vitals.glucose_mgdl > 1500)) {
    errors.push({ param: "glucose_mgdl", message: "Blood glucose must be between 1 and 1500 mg/dL. Re-measure." });
  }

  return errors;
}

function scoreBand(value: number, bands: Array<{ min?: number; max?: number; score: number }>): number {
  for (const band of bands) {
    const minPass = band.min === undefined || value >= band.min;
    const maxPass = band.max === undefined || value <= band.max;
    if (minPass && maxPass) {
      return band.score;
    }
  }
  return 0;
}

export function evaluateVitals(
  vitals: VitalsInput | undefined,
  context: {
    age_years: number;
    pregnant?: boolean;
    tags: string[];
  },
  ruleDef: RuleSetDefinition,
): VitalsEvalResult {
  const flags: VitalFlag[] = [];
  const firedExtraRules: string[] = [];
  const tasks: string[] = [];

  if (!vitals) {
    return { level: null, flags: [], totalScore: 0, firedExtraRules: [], tasks: [], implausible: [] };
  }

  const implausible = validateVitalsPlausibility(vitals);
  const validVitals: VitalsInput = { ...vitals };
  for (const err of implausible) {
    delete (validVitals as Record<string, unknown>)[err.param];
    tasks.push(`remeasure_${err.param}`);
  }

  // Children (< 12 years): NEWS2 Scale 1 is not validated for pediatric patients.
  // Rule specification: "child vitals can only raise to SOON (and IMMEDIATE with SpO2<=92 or lethargy), never lower."
  const isChild = context.age_years < 12;

  let vitalsLevel: Level | null = null;
  let totalScore = 0;

  if (isChild) {
    if (validVitals.spo2 !== undefined) {
      if (validVitals.spo2 <= 92) {
        flags.push({ param: "spo2", score: 3, value: validVitals.spo2 });
        vitalsLevel = "IMMEDIATE";
      } else if (validVitals.spo2 <= 95) {
        flags.push({ param: "spo2", score: 1, value: validVitals.spo2 });
        vitalsLevel = "SOON";
      }
    }
    if (validVitals.consciousness && validVitals.consciousness !== "alert") {
      flags.push({ param: "consciousness", score: 3, value: validVitals.consciousness });
      vitalsLevel = "IMMEDIATE";
    }
    if (validVitals.temp_c !== undefined && (validVitals.temp_c >= 38.5 || validVitals.temp_c < 36.0)) {
      flags.push({ param: "temp_c", score: 1, value: validVitals.temp_c });
      if (!vitalsLevel) vitalsLevel = "SOON";
    }
    totalScore = flags.reduce((sum, f) => sum + f.score, 0);
  } else {
    // Adults (>= 12y): full NEWS2 Scale 1 scoring
    const bands = ruleDef.vitals.bands;

    if (validVitals.rr !== undefined) {
      const score = scoreBand(validVitals.rr, bands.rr);
      if (score > 0) flags.push({ param: "rr", score, value: validVitals.rr });
    }

    if (validVitals.spo2 !== undefined) {
      const score = scoreBand(validVitals.spo2, bands.spo2);
      if (score > 0) flags.push({ param: "spo2", score, value: validVitals.spo2 });
    }

    if (validVitals.sbp !== undefined) {
      const score = scoreBand(validVitals.sbp, bands.sbp);
      if (score > 0) flags.push({ param: "sbp", score, value: validVitals.sbp });
    }

    if (validVitals.hr !== undefined) {
      const score = scoreBand(validVitals.hr, bands.hr);
      if (score > 0) flags.push({ param: "hr", score, value: validVitals.hr });
    }

    if (validVitals.temp_c !== undefined) {
      const score = scoreBand(validVitals.temp_c, bands.temp_c);
      if (score > 0) flags.push({ param: "temp_c", score, value: validVitals.temp_c });
    }

    if (validVitals.consciousness) {
      const score = bands.consciousness[validVitals.consciousness] ?? 0;
      if (score > 0) {
        flags.push({ param: "consciousness", score, value: validVitals.consciousness });
      }
    }

    totalScore = flags.reduce((sum, f) => sum + f.score, 0);

    const hasScore3 = flags.some((f) => f.score >= 3);
    const hasScore2 = flags.some((f) => f.score === 2);

    if (hasScore3 || totalScore >= 5) {
      vitalsLevel = "IMMEDIATE";
    } else if (hasScore2 || totalScore >= 3) {
      vitalsLevel = "SOON";
    }

    if (validVitals.consciousness && validVitals.consciousness !== "alert") {
      vitalsLevel = "IMMEDIATE";
    }
  }

  // --- Extras ---
  // High BP (V-BP-HIGH)
  if (
    validVitals.sbp !== undefined &&
    (validVitals.sbp >= 180 || (validVitals.dbp !== undefined && validVitals.dbp >= 120))
  ) {
    firedExtraRules.push("V-BP-HIGH");
    const redFlagSymptoms = ["chest_pain", "severe_headache", "arm_leg_weakness", "confusion"];
    const hasRedFlag = context.tags.some((t) => redFlagSymptoms.includes(t));
    if (hasRedFlag) {
      vitalsLevel = "IMMEDIATE";
    } else if (vitalsLevel !== "IMMEDIATE") {
      vitalsLevel = "SOON";
    }
  }

  // Pregnancy Severe Hypertension (V-BP-PREG)
  if (context.pregnant && validVitals.sbp !== undefined) {
    const isHighSBP = validVitals.sbp >= 160;
    const isHighDBP = validVitals.dbp !== undefined && validVitals.dbp >= 110;
    if (isHighSBP || isHighDBP) {
      firedExtraRules.push("V-BP-PREG");
      vitalsLevel = "IMMEDIATE";
    }
  }

  // Hypoglycemia with symptoms (V-GLU-LOW)
  if (validVitals.glucose_mgdl !== undefined && validVitals.glucose_mgdl < 70) {
    const hypoTags = ["sweating", "drowsy", "confusion", "shaky_sweaty"];
    const hasHypoTag = context.tags.some((t) => hypoTags.includes(t));
    if (hasHypoTag) {
      firedExtraRules.push("V-GLU-LOW");
      vitalsLevel = "IMMEDIATE";
    }
  }

  return {
    level: vitalsLevel,
    flags,
    totalScore,
    firedExtraRules,
    tasks,
    implausible,
  };
}
