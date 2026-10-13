# Triage Engine Specification

Source data: `data/rules.json` (rules, vitals bands, modifiers, safety), `data/symptoms.json` (tiles), `data/tags.json` (follow-ups), `data/departments.json`.
Status: **starter rule set, clinical sign-off pending**.

## 1. Inputs and outputs

```ts
type Level = 'IMMEDIATE' | 'SOON' | 'ROUTINE';

interface TriageInput {
  age_years: number;            // support months for <2 via age_months
  age_months?: number;
  sex: 'M' | 'F' | 'O';
  pregnant?: boolean;
  conditions: string[];         // ids from symptoms.json "conditions"
  tags: string[];               // tiles + follow-ups + LLM-suggested (marked by source)
  tag_sources?: Record<string, 'receptionist' | 'keyword' | 'llm' | 'nurse'>;
  free_text?: string;
  unmatched_text?: boolean;
  vitals?: { rr?: number; spo2?: number; sbp?: number; dbp?: number; hr?: number; temp_c?: number;
             consciousness?: 'alert'|'confused'|'voice'|'pain'|'unresponsive'; glucose_mgdl?: number };
  season?: 'summer' | 'monsoon' | 'winter';
  is_revisit_72h?: boolean;
  nurse_level?: Level;          // a nurse override, if any
}

interface TriageResult {
  level: Level;
  reason_en: string; reason_hi: string;     // generated from the fired rule
  fired_rules: string[];                    // e.g. ['R01','MOD-AGE']
  vitals_flags: { param: string; score: number }[];
  tasks: string[];                          // e.g. 'measure_bp_pulse_spo2'
  dept_hint: string;                        // from the highest-level fired rule, else tile default
  needs_verification: boolean;              // true if unmatched text or LLM-sourced tags involved
  rule_version: string;
}
```

## 2. Pipeline

```
1. Normalise input; reject implausible vitals (SpO2>100, HR<=0 ...) -> ask to re-measure (S-5)
2. Layer 1  Vitals scoring (NEWS2 Scale 1) -> vitals_level
              any single param score 3  -> IMMEDIATE
              any single param score 2  -> SOON
              aggregate >= 5            -> IMMEDIATE
              aggregate 3-4             -> SOON
              consciousness not alert   -> IMMEDIATE
              extras: BP high, pregnancy BP, low glucose (see rules.json vitals.extras)
              children: age-banded branch, raise only
3. Layer 2  Rules: evaluate every rule's `when` against tags + context -> symptom_level + fired rules
4. Layer 3  Modifiers: if something fired (not Q01/Q02) and any modifier true -> bump one level (cap IMMEDIATE)
5. Layer 4  Safety:
              level = max(vitals_level, symptom_level, modifiers)        (S-1 highest wins)
              if red-flag fired and vitals missing -> bump one level + task measure vitals  (S-2)
              if unmatched_text and level == ROUTINE -> SOON + task nurse_verify_symptom  (S-3)
              if is_revisit_72h and something fired -> bump one level (proposed)
              LLM-sourced tags may raise but never remove or lower anything
              if nurse_level present -> final = nurse_level (human authority), but record system level
              on any exception -> SOON, reason "Manual triage required" (S-8)
6. Reason: take the reason template of the highest-level fired rule; append "Vitals not recorded: measure now." if tasks include measure_*
7. Department: dept_hint of the highest-level rule; Immediate -> EMERG regardless; else tile default; receptionist may change
```

## 3. Level definitions (placeholders pending sign-off)

| Level | Meaning | Action | Target |
|---|---|---|---|
| IMMEDIATE | Possible life-threatening problem | Nurse now; casualty route; alert | seen within 5 min |
| SOON | Needs timely assessment ahead of routine | Vitals and doctor before Routine | within 30 min |
| ROUTINE | Stable or administrative | Token order | within 120 min, else Overdue flag |

## 4. Safety invariants (enforced by tests)

1. `level >= max(any single fired rule level)`; never averaged.
2. Removing a vital never lowers the level. Property test: for any input, deleting optional vitals gives level >= the level with those vitals normal.
3. Adding an LLM-sourced tag never lowers the level.
4. Unmatched text never yields ROUTINE.
5. A system recomputation never lowers a level below a standing nurse override or a previously fired red flag unless a nurse lowers it.
6. Engine is pure and deterministic: same input and rule version give the same output.
7. Engine failure returns SOON.

## 5. Department routing

- Tile `suggested_dept` gives the default (e.g. pregnancy → OBG, child tiles → PAED, eye → OPHTH).
- Age under 12 and tile defaulting to GEN_MED → suggest PAED.
- Pregnant → suggest OBG unless the chief complaint is clearly unrelated and nurse decides.
- Rule `dept_hint` wins for flagged cases (R08 → OBG, R09 → PAED, R15 → SURG).
- **IMMEDIATE → EMERG (Casualty)** regardless; the visit keeps its original department for follow-up.
- Receptionist can change the department; the change is logged (`department_changed`) and the visit gets a new token in the new department queue (keeping `registered_at`/`sort_key` so waiting time is not reset).
- Priority is department-independent; **queues are per department**.

## 6. Returning-patient logic

- Stored `conditions` (nurse-verified) feed modifiers and rules (`cond`).
- **Follow-up / refill** tiles with no other symptoms → Routine (Q02).
- **Revisit within 72 hours** with the same tile or department → flag `is_revisit_72h`, bump one level when something fired, and show "Seen on {date} for {tile}" on the nurse card.
- **Duplicate today:** if the patient has an active visit today, the receptionist sees a warning and must confirm to create another.
- Previous Immediate flags show a "previous red flag" badge for nurse awareness (never auto-lowers).

## 7. Explanation strings

Generated from the fired rule's `reason_en` / `reason_hi`, with `{age}` filled. Examples:

- `IMMEDIATE`: *Chest tightness with sweating, arm/jaw pain, breathlessness or fainting in a 60-year-old; possible cardiac event. Vitals not recorded: measure BP, pulse and SpO2 now.*
- `SOON`: *Fever with warning signs in monsoon season; dengue possible.*
- `ROUTINE`: *Routine refill, follow-up or paperwork; no symptoms reported.*

Patient-facing messages never use these; they use generic wait reasons (see N8 templates).

## 8. Test strategy (Vitest)

- Table-driven scenarios from `docs/SAFETY_PRIVACY_TESTING.md` (40+).
- Property tests: vitals removal monotonic; tag addition monotonic; determinism.
- Snapshot of `rules.json` hash stored with each test run to catch silent rule edits.
- Coverage target for `src/engine`: 95%+.

## 9. Clinical sign-off workflow

1. Clinicians review `rules.json` in the admin rule viewer; edit as draft.
2. Draft becomes a new `rule_sets` version; scenario tests must pass in CI.
3. An admin approves the version; the active version updates; each visit stores the version used.
4. Retired versions stay for audit replay.
