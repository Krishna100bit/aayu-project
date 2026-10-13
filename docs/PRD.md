# TriageLane: Product Requirements Document (PRD)

Version 0.1 · 2026-10-13 · Hackathon problem statement T05 `/opd-flow`

## 1. Summary

Government OPDs run on token numbers. A token encodes only arrival order, so a 60-year-old with chest tightness and sweating (Token 87) waits behind a routine thyroid refill (Token 23), and nobody measures his vitals until he reaches the doctor.

**TriageLane** captures symptoms and basic vitals at registration, suggests a priority (**Immediate / Soon / Routine**) with a plain reason, keeps a **live per-department queue**, lets a **nurse verify, reorder and override** in one tap, **notifies the patient** about their position and the reason for the wait, and records everything in an **audit trail**. It works with partial vitals and errs on the side of caution.

## 2. Goals and non-goals

### Goals
1. Surface high-risk patients early, without diagnosing.
2. Keep registration under 60 seconds for a non-medical receptionist.
3. Keep patients informed (position, ETA, reason) so crowds and anxiety fall.
4. Give nurses fast control (verify, reorder, override) with accountability.
5. Support multiple departments and returning patients.
6. Be safe, explainable and auditable; no black-box decisions.
7. Be demo-ready for a local (Jodhpur) audience in Hindi.

### Non-goals
- Diagnosis, prescribing, treatment advice.
- Replacing nurses or doctors.
- Full hospital information system (billing, pharmacy, lab, inpatient).
- Real patient data in the prototype.

## 3. Context: a Jodhpur-style government OPD

| Reality | Design response |
|---|---|
| Hindi is primary; many patients also speak Marwari; some have low literacy | Hindi-first UI, icon tiles, voice input, Marwari-friendly synonym dictionary built with local staff |
| Large crowds, patients and attendants standing in corridors | Live status page by QR, notifications, waiting-hall display, "come back by" guidance |
| Patients travel from villages around the city and may step out for food or tea | Notifications with realistic ETA range; "you can step out, come back by HH:MM" |
| One family phone often serves several patients | `phone_is_shared` flag; every message includes token and patient first name initial only |
| WhatsApp is the most-used app; some patients use feature phones | WhatsApp primary, SMS fallback, printed QR/token slip |
| Seasonal load: summer heat (heat stroke, dehydration), monsoon (dengue, gastro), scorpion/snake exposure in rural areas, stone and mining work (silicosis/TB suspicion), road accidents | Local rule pack `jodhpur` (R13, L01-L05, S02) switched by season setting |
| Intermittent internet | Client-side rules, offline outbox, sync on reconnect |
| Staff are busy | One-tap actions, no typing for common cases, reason codes via dropdown |

## 4. Personas

| Persona | Needs | Pain today |
|---|---|---|
| **Receptionist (Ramesh)** | Register fast; not be responsible for medical judgement | Long queue, no guidance on who is urgent |
| **Triage nurse (Sunita)** | Know who to see first; take vitals; correct the system | No shortlist; interruptions; verbal reordering with no record |
| **Doctor (Dr. Meena)** | Receive patients sorted with vitals and reason | Patients arrive unsorted, vitals missing |
| **Patient (Kamla, 62)** | Know when her turn is and why she waits | Waits blindly; fears being skipped |
| **Attendant (Mohan)** | Know when to bring the patient to the room | Cannot leave the line |
| **HOD / Admin** | Wait times, overrides, safety | No data |

## 5. User stories and acceptance criteria

### Receptionist
| ID | Story | Acceptance |
|---|---|---|
| US-R1 | As a receptionist I search for an existing patient by phone, name or OPD card no. so I do not retype | Search returns matches in under 1 s; selecting pre-fills demographics, conditions, last visit |
| US-R2 | I register a new patient with only name, age, sex (phone optional) | Only 3 fields mandatory; token issued even with no symptoms (defaults per rules) |
| US-R3 | I pick symptoms from tiles and answer short yes/no follow-ups | Tiles grouped and searchable (Hindi/English); follow-ups appear only for tapped tiles; max 2 sheets |
| US-R4 | I type or speak an unusual symptom | Free text accepted; matcher + LLM suggestions appear as a note "Nurse will verify"; registration not blocked |
| US-R5 | I see the suggested priority, reason and department, and confirm | I can change **department**, never the **priority** |
| US-R6 | I capture consent and phone for notifications | Consent tick stored with timestamp; none = no messages, QR slip still printed |
| US-R7 | I print or show a token slip with QR | Slip shows token, department, room (if known), QR to status page |

### Nurse
| ID | Story | Acceptance |
|---|---|---|
| US-N1 | See my department queue in three lanes sorted by priority then order | Live updates within 2 s via Realtime; counters per lane |
| US-N2 | Enter vitals and extra details (history, allergies, medicines, conditions) | Saving re-runs the engine; changes logged; patient notified of triage completion |
| US-N3 | Verify unusual symptoms suggested by the LLM | Accept / edit / reject; set priority; optionally "propose to catalogue" |
| US-N4 | Move a patient up or down | Drag or arrow buttons; within lane = reorder (quick reason optional); across lane = override (reason required) |
| US-N5 | Override priority in one tap | Choose level, choose reason code from dropdown; audit entry written; patient position recomputed |
| US-N6 | Send an Immediate patient to casualty | One button; status `sent_emergency`; casualty alert via n8n |
| US-N7 | Call next patient / skip no-show | Call triggers "come now" notification; skip after timeout |
| US-N8 | Get alerts for Immediate arrivals and overdue patients | Sound + flash + n8n push to nurse group |

### Doctor
| ID | Story | Acceptance |
|---|---|---|
| US-D1 | See my queue with reason and vitals | Read-only triage info; "call next", "done", "refer" actions |
| US-D2 | Mark follow-up needed | Stored for revisit logic |

### Patient / attendant
| ID | Story | Acceptance |
|---|---|---|
| US-P1 | Receive a message after registration with token, department, position, ETA range, reason for wait, link | Delivered in under 30 s; no symptoms or diagnosis in text |
| US-P2 | Receive an update when the nurse finishes details | Includes updated position and reason |
| US-P3 | Receive "your turn is near" and "come now" | Near at position <= 3; call message includes room |
| US-P4 | Open a status page with no login | Unguessable URL; shows token, position, ETA range, reason, Hindi/English |
| US-P5 | Get notified of delays caused by emergencies | Sent only when position worsens by 3 or ETA by 15 min; rate-limited |

### Admin
| ID | Story | Acceptance |
|---|---|---|
| US-A1 | View rules and sources; propose edits; approve a new version | Edit creates new `rule_sets` version; engine reads active version; every suggestion stores the version |
| US-A2 | Manage departments, rooms, users, settings | CRUD with audit |
| US-A3 | See analytics | Wait by level and dept, override rate and direction, level mix, peak hours, notification delivery |
| US-A4 | Approve symptom proposals from nurses | Approved items become tags/synonyms for everyone |

## 6. Functional requirements

IDs map to `docs/FEATURES.md`.

- **FR-1 Auth and roles** (receptionist, nurse, doctor, admin) via Supabase Auth with RLS.
- **FR-2 Patient registry** with returning-patient search, UHID, shared-phone handling, consent.
- **FR-3 Registration** with symptom tiles, follow-ups, free text, voice, vitals (optional), department selection.
- **FR-4 Triage engine**: vitals scoring, red-flag rules, modifiers, safety rules, department hint, explanation string, tasks.
- **FR-5 LLM parser** for unmatched free text: suggest tags only; always flags for nurse verification.
- **FR-6 Queue engine**: per-department ordering by level then sort_key; fractional-index reorder; aging and overdue flags; position and ETA.
- **FR-7 Nurse dashboard**: lanes, patient card, vitals form, verification, reorder, override, call, emergency transfer.
- **FR-8 Doctor view**.
- **FR-9 Notifications via n8n**: N1-N8 templates (Hindi/English), WhatsApp/Telegram/SMS, dedupe, rate limit, fallback channel.
- **FR-10 Public status page, QR and waiting-hall display**.
- **FR-11 Audit trail**: append-only events for every suggestion, change, notification.
- **FR-12 Revisit logic**: follow-up fast lane, same-complaint revisit within 72 h flagged, duplicate-today warning.
- **FR-13 Admin**: rules, catalogue, departments, users, settings.
- **FR-14 Analytics and daily report** (n8n).
- **FR-15 Localisation**: Hindi and English; Devanagari fonts; voice input where supported.
- **FR-16 Offline**: registration and rule evaluation without internet; outbox sync.
- **FR-17 Demo tooling**: seed data, simulator (FIFO vs TriageLane), reset button.

## 7. Safety requirements (non-negotiable)

1. The engine is deterministic. The LLM never sets or lowers priority.
2. Highest level always wins; signals are never averaged.
3. Missing vitals can only raise priority, with a task to measure them.
4. Unmatched symptoms default to **Soon**, never Routine.
5. Only a nurse (or doctor) can lower a level, with a reason code.
6. Engine failure defaults to **Soon** with "manual triage required".
7. Every suggestion stores the rule version and fired rule IDs.
8. Notifications never include symptoms, diagnosis or other patients' details.
9. Prominent disclaimer in app, README and slides.

## 8. Non-functional requirements

| Area | Requirement |
|---|---|
| Performance | Engine evaluation under 50 ms on a mid-range phone; dashboard update under 2 s |
| Availability | Registration works offline; sync on reconnect; no lost visits |
| Usability | Registration under 60 s; touch targets 48 px+; Hindi/English toggle in one tap |
| Accessibility | High-contrast colours plus icons/labels (never colour alone); large text mode |
| Security | RLS by role; service key server-side only; n8n webhook secret; unguessable status codes; rate limits |
| Privacy | Data minimisation; consent for messages; no PHI in messages; synthetic data in demo; retention setting |
| Auditability | Append-only events; export CSV |
| Cost | Runs on free tiers for demo; LLM cost negligible (only unmatched text) |

## 9. Success metrics

| Metric | Target (prototype / simulation) |
|---|---|
| Immediate cases placed lower than Immediate in scenario tests | 0 |
| Registration time | under 60 s |
| Time to first nurse contact for Immediate (simulated) | under 5 min vs ~90 min FIFO |
| Share of suggestions with a rule-derived reason | 100% |
| Level mix | Immediate a small minority; tracked on dashboard |
| Override rate and direction | Tracked as feedback for rule tuning |
| Notification delivery | above 95% in demo; fallback works |
| Share of unusual symptoms verified by a nurse before consult | 100% |

## 9a. Priority ordering policy (what "good priority" means here)

1. **Lane order:** Immediate, then Soon, then Routine.
2. **Within a lane:** manual nurse order (if set), else arrival time.
3. **Fairness guard (no starvation):** Routine patients waiting beyond the limit are flagged *Overdue* and shown at the top of the Routine lane; Soon patients beyond the limit alert the nurse. Lanes are never silently merged.
4. **Department queues are separate**, but **Immediate** patients are routed to casualty regardless of the department they registered for.
5. **Revisit rule:** same complaint within 72 hours raises the level by one (proposed).
6. **Follow-up/refill fast lane:** routine visits with no symptoms may be seen in a quick refill window if the doctor enables it (setting).
7. **Patients are never told "you are low priority".** They see a calm reason (see N8 templates).

## 10. Scope

### MVP (must demo)
FR-1, FR-2 (basic), FR-3, FR-4, FR-6, FR-7, FR-9 (Telegram + WhatsApp or SMS), FR-10 (status page), FR-11, department queues for 3 departments.

### Strong differentiators
LLM verification loop (FR-5), returning-patient intelligence (FR-12), Hindi UI and voice, offline mode, waiting-hall display, rule transparency page, analytics.

### Stretch
Marwari voice, ABDM/ABHA lookup stub, WhatsApp buttons ("I am stepping out"), SMS DLT production templates, kiosk mode, doctor-specific queues with load balancing.

## 11. Assumptions and constraints
- The hospital provides a desk tablet/PC for the receptionist and a PC/tablet for each nurse.
- Patients can give a mobile number and consent; otherwise QR slip only.
- WhatsApp production messaging needs a verified business account and approved templates; the demo uses the Cloud API test number or Telegram. SMS in India requires DLT-registered templates for production.
- Clinical content is reviewed by the team's MBBS members; the app marks all unreviewed content.

## 12. Risks

| Risk | Mitigation |
|---|---|
| Over-triage fills the red lane | Level-mix counter, combination rules, review override rate |
| Under-triage of atypical cases | S10, age/comorbidity modifiers, unmatched defaults to Soon, nurse verification |
| LLM hallucination | Tag whitelist, JSON schema, raise-only, nurse verification, no PHI sent |
| Patients misread priority | No colour names in messages; friendly reason text |
| Notification spam | Dedupe keys, rate limits, material-change triggers |
| Shared phones confuse messages | Token + first initial in every message; per-visit status code |
| Connectivity loss | Offline-first engine and outbox |
| Regulatory | Decision-support positioning, synthetic data, disclaimer, validation roadmap |

## 13. Release plan
See `MASTER_PROMPT.md` for phases 0-10 and the fast-track order for a short hackathon.
