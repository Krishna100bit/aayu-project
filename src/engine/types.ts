import { z } from "zod";
import type { Level } from "./levels";

export type { Level };

export interface VitalsInput {
  rr?: number;
  spo2?: number;
  sbp?: number;
  dbp?: number;
  hr?: number;
  temp_c?: number;
  consciousness?: "alert" | "confused" | "voice" | "pain" | "unresponsive";
  glucose_mgdl?: number;
}

export type TagSource = "receptionist" | "keyword" | "llm" | "nurse";

export interface TriageInput {
  age_years: number;
  age_months?: number;
  sex: "M" | "F" | "O";
  pregnant?: boolean;
  conditions: string[];
  tags: string[];
  tag_sources?: Record<string, TagSource>;
  free_text?: string;
  unmatched_text?: boolean;
  vitals?: VitalsInput;
  season?: "summer" | "monsoon" | "winter";
  is_revisit_72h?: boolean;
  nurse_level?: Level;
}

export interface VitalFlag {
  param: string;
  score: number;
  value?: number | string;
}

export interface TriageResult {
  level: Level;
  reason_en: string;
  reason_hi: string;
  fired_rules: string[];
  vitals_flags: VitalFlag[];
  tasks: string[];
  dept_hint: string;
  needs_verification: boolean;
  rule_version: string;
}

/* ---------------- Rule Set Schema ---------------- */

export type RuleDslCondition =
  | { tag: string }
  | { all: RuleDslCondition[] }
  | { any: RuleDslCondition[] }
  | { age_gte: number }
  | { age_lt_years: number }
  | { age_gt?: number }
  | { pregnant: boolean }
  | { cond: string }
  | { season: "summer" | "monsoon" | "winter" }
  | { unmatched_text: boolean }
  | { [key: string]: unknown };

export interface ClinicalRule {
  id: string;
  level: Level;
  pack?: string;
  when: RuleDslCondition;
  reason_en: string;
  reason_hi: string;
  concern?: string;
  dept_hint?: string;
  tasks?: string[];
  status?: string;
}

export interface VitalBand {
  min?: number;
  max?: number;
  score: number;
}

export interface HighBPExtra {
  id: string;
  when: string;
  level: Level;
  escalate_to_immediate_with?: string[];
  status?: string;
}

export interface LowGlucoseExtra {
  id: string;
  when: string;
  level: Level;
  status?: string;
}

export interface RuleSetDefinition {
  version: string;
  status?: string;
  levels: Level[];
  vitals: {
    scale: string;
    bands: {
      rr: VitalBand[];
      spo2: VitalBand[];
      sbp: VitalBand[];
      hr: VitalBand[];
      temp_c: VitalBand[];
      consciousness: Record<string, number>;
    };
    mapping: {
      any_single_param_score: Record<string, Level>;
      aggregate: Record<string, Level>;
    };
    extras: Array<{
      id: string;
      when: string;
      level: Level;
      escalate_to_immediate_with?: string[];
      status?: string;
    }>;
    children?: {
      note?: string;
      reference_normal_ranges_apls_style?: Record<string, unknown>;
    };
  };
  modifiers: {
    bump_one_level_if_any: Array<{
      age_gt?: number;
      age_lt_years?: number;
      pregnant?: boolean;
      cond_any?: string[];
    }>;
    only_if_something_fired: boolean;
    cap: Level;
    never_applies_to_rules: string[];
  };
  safety: {
    highest_level_wins: boolean;
    missing_vitals_with_red_flag: string;
    unmatched_text_default: Level;
    engine_error_default: Level;
    only_nurse_can_lower: boolean;
    llm_may_only_raise: boolean;
  };
  time_targets_minutes: Record<Level, number>;
  rules: ClinicalRule[];
}

export const triageInputSchema = z.object({
  age_years: z.number().min(0).max(130),
  age_months: z.number().min(0).max(24).optional(),
  sex: z.enum(["M", "F", "O"]),
  pregnant: z.boolean().optional(),
  conditions: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  tag_sources: z.record(z.string(), z.enum(["receptionist", "keyword", "llm", "nurse"])).optional(),
  free_text: z.string().max(500).optional(),
  unmatched_text: z.boolean().optional(),
  vitals: z
    .object({
      rr: z.number().optional(),
      spo2: z.number().optional(),
      sbp: z.number().optional(),
      dbp: z.number().optional(),
      hr: z.number().optional(),
      temp_c: z.number().optional(),
      consciousness: z.enum(["alert", "confused", "voice", "pain", "unresponsive"]).optional(),
      glucose_mgdl: z.number().optional(),
    })
    .optional(),
  season: z.enum(["summer", "monsoon", "winter"]).optional(),
  is_revisit_72h: z.boolean().optional(),
  nurse_level: z.enum(["IMMEDIATE", "SOON", "ROUTINE"]).optional(),
});
