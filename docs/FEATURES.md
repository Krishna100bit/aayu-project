# Feature Catalogue

Every feature has: purpose, behaviour, edge cases, acceptance criteria (AC), main libraries. IDs are referenced by `MASTER_PROMPT.md` phases.

---
## F1 Authentication and roles
**Purpose:** secure staff access with simple roles. **Behaviour:** Supabase email/password login; roles `receptionist | nurse | doctor | admin` in `profiles`; nurse/doctor have a home department; language preference per user. Role-based landing page. **Edge:** session expiry → silent refresh; shared desk login discouraged (audit uses user id). **AC:** each role sees only its screens; direct URL to another role's page redirects; RLS blocks cross-role writes. **Libs:** Supabase Auth, `@supabase/ssr`.

## F2 Patient registry and returning patients
**Purpose:** persistent identity so repeat visits are fast and safer. **Behaviour:** search box (phone, name, OPD card no.) with Fuse.js fuzzy match on Roman/Devanagari names; results show age, last visit date, last department; selecting pre-fills demographics, nurse-verified conditions, allergies, preferred language/channel. "New patient" creates a record. Shared-phone flag allows several patients on one number. **Revisit intelligence:** shows "last seen {date} for {tile}"; same complaint within 72 h gets a **Revisit** badge and one-level bump (when a symptom fired); active visit today triggers a duplicate warning; previous Immediate flag shows a "previous red flag" badge. **Edge:** merge duplicates (admin); age auto-updates from birth year; minors flagged for guardian phone. **AC:** returning patient registered in under 30 s; stored conditions change engine output (e.g. diabetes modifier); duplicate-today warning appears. **Libs:** Fuse.js, Postgres trigram optional.

## F3 Receptionist registration screen
**Purpose:** fast, low-literacy-friendly capture. **Layout:** (1) patient strip (name, age, sex, phone, consent), (2) symptom tiles grid grouped by category with a search bar, (3) optional vitals/conditions drawer (collapsed), (4) result strip (suggested priority, reason, department, tasks) and a single **Confirm and print slip** button. **Rules:** only name, age, sex mandatory; pregnancy question shown for females aged 12-50; department pre-filled from the engine and editable; priority is shown but **not editable**. **Edge:** offline mode (F20); double-submit guard; unsaved-changes prompt. **AC:** keyboard and touch usable; 60-second registration in usability test; slip prints with QR. **Libs:** shadcn/ui, react-hook-form + Zod.

## F4 Predefined symptom picker
**Purpose:** minimise typing; standardise data. **Behaviour:** tiles from `data/symptoms.json` (42 tiles, 60 follow-up tags): icon + Hindi/English label, category chips (Emergency signs, Heart & breathing, Common, Stomach, Injury, Bites & poison, Season (Jodhpur), Women, Children, Eye, ENT, Dental, Skin, Bones & joints, Urine, Chronic, Chest, Mental health, Routine visit, Other). Tapping a red-flag-candidate tile opens a one-sheet follow-up with big Yes/No chips; common tiles follow-up is optional. **Smart suggestions:** as the receptionist types in the search box, matching tiles surface first (synonyms in Devanagari and Roman Hindi). **Age/sex aware:** child tiles shown first for age under 12; pregnancy/women tiles for F 12-50. **Season aware:** Jodhpur pack tiles (heat stroke, scorpion sting) lifted in summer; fever/dengue in monsoon. **Edge:** multi-select; removing a tile removes its follow-ups; "Something else" opens F5. **AC:** 90% of test registrations need no typing; every tile has Hindi and English labels. **Libs:** Fuse.js, lucide-react, next-intl.

## F5 Free text, voice input and keyword safety net
**Purpose:** catch what tiles miss and prevent wrong-tile errors. **Behaviour:** free-text field (type or voice via Web Speech API `hi-IN`); a keyword matcher runs on every change (normalises spacing, matras and Roman spellings) and **adds tags** if a red-flag phrase appears even when another tile was chosen; leftover unmatched text goes to F6. **Edge:** speech API not available → typing only; noisy text; mixed scripts. **AC:** scenario "saans phool rahi hai" with the cold tile gives Immediate; keyword dictionary is data-driven (symptoms.json synonyms). **Libs:** Web Speech API, Fuse.js.

## F6 LLM assist for unique symptoms (nurse-verified)
See `docs/LLM_SYMPTOM_PARSER.md`. **Behaviour:** unmatched text → `/api/llm/parse` → suggestions shown to the receptionist as "Nurse will verify"; visit marked `needs_verification`, level at least Soon; nurse card shows the **verify panel**. Nurse sets final tags and priority; may suggest catalogue addition (F19). **AC:** LLM never changes level on its own; outage degrades to unmatched → Soon; verification logged with before/after.

## F7 Triage engine
See `docs/TRIAGE_ENGINE.md`. **Behaviour:** deterministic evaluation on client (instant, offline) and server (authoritative); returns level, bilingual reason, fired rules, tasks, department hint, `needs_verification`. **AC:** 40+ scenarios pass; property tests pass (monotonic with missing vitals and LLM tags); deterministic.

## F8 Departments, rooms and doctors
**Purpose:** per-department queues and routing. **Behaviour:** departments from `departments.json` (General Medicine, Paediatrics, OBG, Orthopaedics, Surgery, ENT, Ophthalmology, Dermatology, Cardiology, Psychiatry, Dental, Emergency). Rooms linked to departments; a doctor logs in to a room (active doctors per department drive ETA). Token labels like `GEN_MED-087`, numbered per department per day. Engine suggests the department; reception confirms; nurse can transfer (new token, same `registered_at` and `sort_key` so wait time is not reset). **Immediate** → Casualty queue. **Edge:** no doctor online → ETA shows "doctor not available yet" and nurse alert; closed department hidden from tiles. **AC:** three departments demoed with independent queues; transfer logged; ETA uses active doctors.

## F9 Queue engine (priority order)
See Architecture §5. **Behaviour:** lanes by level, then manual order, then arrival; fairness guard (Overdue flags); positions and ETA ranges computed server-side; recomputed on every change. **AC:** reorder updates one row (fractional index); Overdue Routine surfaces at top of Routine lane only; position never shown as a promise.

## F10 Nurse dashboard
**Purpose:** the control room. **Layout:** department selector (default home dept); three lanes (Immediate red, Soon amber, Routine green) with counters and level-mix bar; each **patient card** shows token, age/sex, tiles as chips, reason (one line), waiting time with Overdue badge, vitals snapshot, tasks ("Measure BP now"), badges (Revisit, Needs verification, Previous red flag, Pregnant, Child). Card actions: **Add vitals/details**, **Verify symptom**, **Override**, **Move up/down**, **Call**, **Send to casualty**, **Change department**. Filters: only my department / all, Needs verification, Overdue. Sound + flash on new Immediate. Keyboard shortcuts (J/K to select, U/D to move, 1/2/3 to set level). **AC:** updates within 2 s; every action writes an audit event; works on a tablet.

## F11 Vitals and detail entry
**Purpose:** collect objective data and complete triage. **Fields:** pulse, BP (systolic/diastolic), SpO₂, temperature, respiratory rate, consciousness (Alert / Confused / Voice / Pain / Unresponsive), blood glucose (optional), pain 0-10, weight (children), conditions checklist (verified), allergies, current medicines, pregnancy weeks, notes. Plausibility checks (e.g. SpO₂ ≤ 100). Saving re-runs the engine; if the level rises, an alert fires; if it falls, the nurse must confirm (lowering needs a reason code). Sets `vitals_taken_at`, `triaged_at`; triggers N2. **Edge:** repeated vitals create a trend list; partial vitals allowed. **AC:** Token 87 re-evaluates from "vitals missing" to scored reason; NEWS2 sub-scores visible on tap.

## F12 Override and reorder (one tap)
**Override:** tap level chip on card → choose reason code (dropdown) → saved. **Reason codes:** *Raise:* clinical judgement, abnormal vitals on re-measure, patient deteriorating, attendant concern, red flag not captured. *Lower:* vitals normal on re-measure, symptom resolved or mis-selected, stable chronic issue, data entry error. *Either:* reassessed by doctor, other (note required). **Reorder:** drag handle or up/down arrows within a lane (fractional index). Moving across lanes = override. Doctor can override too. **Rules:** lowering is human-only; system recompute never undoes a nurse decision. **AC:** audit shows who, when, from, to, reason; patient position recomputed; N3 sent only if material.

## F13 Doctor view
Queue for the doctor's department with triage reason, vitals, history badges; actions **Call next**, **Start**, **Done**, **Refer to department**, **Follow-up needed (date)**. Shows room status. Read-only for triage fields except override. **AC:** consult durations recorded to improve ETA.

## F14 Patient notifications (via n8n)
See `docs/N8N_WORKFLOWS.md`. **Triggers:** N1 on registration, N2 when nurse finishes vitals/details (includes updated position and reason), N3 delay, N4 near turn, N5 called (room), N6 no-show, N7 attendant for Immediate. Channels: WhatsApp, Telegram, SMS with fallback. Messages contain token, first initial, department, position, ETA range, generic reason, link; **never symptoms or diagnosis**. Consent required; dedupe and rate limits. **AC:** N1 within 30 s; no duplicate sends; fallback works.

## F15 Public status page, QR and waiting-hall display
**Status page** `/s/{code}`: token, department, position, ETA range, calm reason, "called to Room X", Hindi/English toggle, auto-refresh; no login; no names. **QR** on the printed slip and on the confirmation screen. **Display board** `/display/{dept}`: large "Now serving" token labels and next 5 tokens (labels only), auto-refresh, Hindi/English, optional audio chime. **AC:** unguessable code; page works on 2G (light HTML); display never shows personal data.

## F16 Audit trail
Append-only `triage_events` (DB trigger blocks update/delete). Event types: registered, suggested, llm_suggested, vitals_added, verified, overridden, reordered, department_changed, escalated, called, seen, skipped, sent_emergency, notified. Viewer with filters (patient, token, user, date, type), per-visit timeline, **CSV export**. Each suggestion stores `rule_version` and fired rules so any decision can be replayed. **AC:** override appears within seconds; export opens in Excel.

## F17 Escalation and alerts
Immediate unseen > 5 min → senior nurse and duty doctor (n8n Telegram); Soon over 30 min → nurse alert; Routine over 120 min → Overdue badge; no-show after call → N6 then skip. Thresholds in settings. On-screen sound and flash for Immediate arrival. **AC:** simulated timers fire correctly with demo speed-up setting.

## F18 Analytics and daily report
Cards and charts: visits by level and department, mean and 90th percentile wait by level, Immediate time-to-nurse, override rate by direction, level mix (over-triage watch), peak hours, notification delivery, LLM usage and verification rate. FIFO-vs-TriageLane simulator comparison. n8n daily summary. **Libs:** Recharts.

## F19 Admin: rules, catalogue, departments, users, settings
**Rule viewer/editor:** table of rules (ID, level, condition, reason, source, status); edit as draft; version, approve; test panel to run a scenario against draft vs active. **Catalogue:** approve nurse-proposed phrases/tags. **Departments/rooms/users:** CRUD. **Settings:** time targets, season (summer/monsoon/winter), notify limits, show-group-to-patient, language defaults, demo speed. Every change audited. **AC:** rule change creates a new version and affects only new evaluations.

## F20 Localisation, accessibility and offline
Hindi default, English toggle; Noto Sans Devanagari; large-text mode; colour + icon + label for levels (never colour alone). Offline PWA: cached shell, catalogue and rules; IndexedDB outbox; sync indicator; client engine. **AC:** airplane-mode registration works and syncs; Lighthouse PWA pass.

## F21 Demo tooling
Seed script (users, rooms, 60 synthetic patients, Token 23/87 scenario); **Simulator** that replays 200 synthetic arrivals under FIFO vs TriageLane and prints wait statistics; "Reset demo data" button (admin, demo mode only); demo speed multiplier for timers; banner "Demo data, not real patients".

## F22 Data governance
Consent capture and timestamp; export/delete a patient's data (admin); retention setting; minimal PII; masked phone in UI (last 4 digits); audit of data views for admins.
