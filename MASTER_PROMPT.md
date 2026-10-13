# TriageLane: Master Prompt and Phased Build Plan

How to use this file with an AI coding agent (Claude Code, Cursor, Windsurf, Copilot Agent):
1. Put this whole package (`docs/`, `data/`, `db/`, `.env.example`, `README.md`) in the repo root.
2. Paste **Part A (Master Prompt)** once at the start of the session, or save it as `CLAUDE.md` / `.cursorrules` / `AGENTS.md`.
3. For each phase, paste that phase's **prompt block** and let the agent work until the **acceptance checklist** is green. Commit after each phase.
4. Do not skip Phase 1 (engine and tests); everything else depends on it.

---
# PART A: MASTER PROMPT (paste once)

```
You are a senior full-stack engineer and medical-software safety reviewer helping a student team build
"TriageLane" for a medical AI hackathon (problem statement T05 /opd-flow). The audience and users are in
Jodhpur, Rajasthan, India: a crowded government OPD, Hindi-first (many speak Marwari), WhatsApp is the main
messaging app, connectivity is unreliable.

PRODUCT
TriageLane captures symptoms and optional vitals at the registration desk, suggests a priority
(IMMEDIATE / SOON / ROUTINE) with a one-line plain reason, keeps a live per-department queue, lets a nurse
verify, reorder and override in one tap, notifies patients (via n8n) about their position, ETA and reason for
the wait, and logs everything in an append-only audit trail. It supports multiple departments, returning
patients, predefined symptom tiles, and a small LLM that only suggests tags for unusual free text, which a
nurse verifies.

READ FIRST (source of truth, follow them exactly)
README.md, docs/PRD.md, docs/ARCHITECTURE.md, docs/FEATURES.md, docs/TRIAGE_ENGINE.md,
docs/LLM_SYMPTOM_PARSER.md, docs/N8N_WORKFLOWS.md, docs/SAFETY_PRIVACY_TESTING.md,
db/schema.sql, data/*.json. If you must deviate, say why and update the doc.

TECH STACK (do not substitute without asking)
Next.js 15 App Router + TypeScript (strict), Tailwind CSS, shadcn/ui, lucide-react, Supabase (Postgres, Auth,
Realtime, RLS), Zod, TanStack Query, dnd-kit, next-intl (hi default, en), Serwist + Dexie for offline, Fuse.js,
Recharts, qrcode, Vitest + Playwright, n8n (Docker) for notifications, Claude Haiku via Anthropic API with an
Ollama fallback for the symptom parser. Package manager: pnpm.

NON-NEGOTIABLE SAFETY INVARIANTS (write tests for each)
1. The triage engine is a pure, deterministic TypeScript function in src/engine with no framework imports.
2. Highest level wins; never average signals.
3. Missing vitals never lower priority; red flag + missing vitals => bump one level + task "measure vitals".
4. Unmatched or unusual symptom text defaults to at least SOON and sets needs_verification.
5. Only a nurse or doctor can lower a level, with a reason code. System recompute never undoes a nurse decision.
6. The LLM never sets or lowers priority. It only suggests tags (whitelisted, Zod-validated), which can only raise.
7. The server recomputes the level; the client cannot set priority.
8. Engine error => SOON with "manual triage required".
9. triage_events is append-only; every suggestion stores rule_version and fired rule ids.
10. Patient notifications never contain symptoms, diagnosis or other patients' data; they carry token + first
    initial, department, position, ETA range and a generic reason.
11. Use synthetic data only. Show the disclaimer: decision support for queue ordering; not a diagnosis;
    thresholds need clinical validation.

UX RULES
Receptionist: only name, age, sex are mandatory; big icon tiles with Hindi/English labels; max two follow-up
taps; priority is shown but not editable; target under 60 seconds.
Nurse: three lanes (Immediate/Soon/Routine), one-tap override with reason dropdown, drag or arrow reorder,
keyboard shortcuts. Never rely on colour alone (icon + label). Touch targets at least 48px. Hindi default.

ENGINEERING RULES
- TypeScript strict; Zod at every boundary; no any.
- Server-side role checks on every API route plus Supabase RLS.
- Small commits, one feature per commit; conventional commit messages.
- Write or update tests with each change; run `pnpm test` and `pnpm lint` before declaring done.
- Never commit secrets; read env via src/lib/env.ts.
- When requirements are ambiguous, choose the safer behaviour for patients and leave a TODO(clinical) comment.
- Keep clinical content in data/*.json, not hard-coded. Mark any new clinical rule status "clinical_signoff_pending".
- After each phase output: what changed, how to run, how to test, open questions.

DEFINITION OF DONE (per phase)
Acceptance checklist green, tests passing, docs updated, no console errors, works on a 360px-wide phone and a tablet.
```

---
# PART B: PHASES

**Fast-track order for a short hackathon (24-48 h):** Phases 0, 1, 2, 3, 4, 6 are the core demo. Add 5 (departments/returning), 7 (LLM) as differentiators, then 8-10 as time allows. Each phase lists a rough effort in "person-hours" for a team of 3-4.

## Phase 0: Foundations (2-3 h)
**Goal:** repo, tooling, env, design tokens, CI.
**Deliverables:** Next.js + Supabase starter; Tailwind + shadcn/ui; folder structure from README; `src/lib/env.ts`; eslint/prettier; Vitest + Playwright configs; `data/` and `docs/` copied in; i18n skeleton (hi/en); base layout with role-based nav and footer disclaimer.
**Prompt:**
```
Phase 0. Scaffold the TriageLane repo per README section 5 using `create-next-app -e with-supabase`. Add Tailwind,
shadcn/ui, next-intl (default locale hi, fallback en), zod, @tanstack/react-query, vitest, playwright, eslint,
prettier. Create src/engine, src/lib, src/llm, src/components, scripts, n8n folders. Add src/lib/env.ts validating
all variables in .env.example. Add a global layout with a language toggle (hi/en), role-aware navigation placeholder,
and a footer with the safety disclaimer from docs/SAFETY_PRIVACY_TESTING.md. Add design tokens for the three levels
(Immediate, Soon, Routine) with colour + icon + label, and a high-contrast mode. Add GitHub Actions running lint,
typecheck and vitest. Do not implement features yet.
```
**Acceptance:** `pnpm dev` runs; language toggle works; `pnpm test` runs (zero tests ok); CI green; disclaimer visible.

## Phase 1: Triage engine and tests (4-6 h) *(critical)*
**Goal:** the deterministic rule engine, fully tested.
**Deliverables:** `src/engine/{types,vitals,rules,modifiers,safety,evaluate,keywords}.ts`; loader for `data/rules.json`; Zod schema for rules; keyword matcher using `data/symptoms.json` synonyms; table-driven scenario tests (40 from docs); property tests; coverage 95%+.
**Prompt:**
```
Phase 1. Implement the triage engine exactly as specified in docs/TRIAGE_ENGINE.md using data/rules.json,
data/symptoms.json, data/tags.json and data/departments.json. Export evaluate(input, rules): TriageResult.
Implement: NEWS2 Scale 1 vitals scoring with the single-parameter rule and aggregate mapping; extras (high BP,
pregnancy BP, low glucose); child branch (raise-only); rule DSL evaluator (tag, all, any, age_gte, age_lt_years,
pregnant, cond, season, unmatched_text); modifiers (only if something fired; never for Q01/Q02); safety layer S-1..S-8;
department hint and EMERG routing for IMMEDIATE; bilingual reason strings with {age}; tasks. Also implement the
keyword safety-net matcher (Devanagari + Roman Hindi normalisation) that returns tags from free text.
Write Vitest tests: all 40 scenarios in docs/SAFETY_PRIVACY_TESTING.md section 5 as a table, plus property tests:
(a) removing optional vitals never lowers the level, (b) adding an llm-sourced tag never lowers the level,
(c) unmatched text never yields ROUTINE, (d) determinism, (e) engine exceptions return SOON.
Do not import React, Next or Supabase in src/engine. Report any scenario whose expected level you think is
clinically questionable instead of changing it silently.
```
**Acceptance:** all scenarios and properties pass; Token 87 (no vitals) → IMMEDIATE with task; Token 23 → ROUTINE; coverage ≥ 95% for `src/engine`.

## Phase 2: Database, auth, roles, seed (3-4 h)
**Goal:** Supabase schema, RLS, users and seed data.
**Deliverables:** apply `db/schema.sql`; typed DB client (generated types); profiles + role guard middleware; `scripts/seed.ts` loading departments, rooms, symptom tags, rule set; demo users per role; 60 synthetic patients; Token 23/87 demo visits.
**Prompt:**
```
Phase 2. Apply db/schema.sql to Supabase (local via `supabase start` or cloud). Generate TypeScript types. Implement
Supabase Auth with email/password, a profiles table linkage, and Next.js middleware that routes by role
(receptionist -> /reception, nurse -> /nurse, doctor -> /doctor, admin -> /admin) and blocks others. Tighten the RLS
policies sketched in schema.sql so each role can only do what docs/FEATURES.md F1 allows; write SQL tests or a script
proving a receptionist cannot update triage_events or lower a level. Write scripts/seed.ts to load data/*.json,
create departments/rooms (2 rooms per major department), demo users (reception@demo, nurse.med@demo,
nurse.paed@demo, doctor.med@demo, admin@demo) and 60 synthetic patients with Hindi names and fake phone numbers,
plus the Token 23 and Token 87 scenario. Print the demo passwords.
```
**Acceptance:** login per role; RLS proof; seed idempotent; `triage_events` update/delete blocked.

## Phase 3: Receptionist dashboard (6-8 h) *(core)*
**Goal:** fast registration with tiles, free text, engine result, token slip.
**Deliverables:** `/reception`: patient strip, tile grid (search, categories, follow-up sheets), free text + voice, vitals drawer, conditions, consent + phone, result strip, department select, confirm → `POST /api/visits`; token slip with QR; recent registrations list; offline detection stub.
**Prompt:**
```
Phase 3. Build the receptionist dashboard per docs/FEATURES.md F3, F4, F5 and docs/PRD.md US-R2..R7.
Use data/symptoms.json for tiles (icons from lucide, Hindi/English labels, categories, search with Fuse.js over
labels and synonyms). Tapping a red_flag_candidate tile opens a single follow-up sheet using tags.json (big Yes/No
chips). Run the client engine on every change and show the result strip (level colour + icon + label, one-line
reason in the current language, suggested department, tasks). Priority is not editable; department is. Only name,
age, sex mandatory; show pregnancy question for F aged 12-50. Add the free-text field with Web Speech API (hi-IN)
and the keyword safety net. Implement POST /api/visits which re-runs the engine server-side (authoritative),
creates/updates the patient, creates the visit with next_token(dept), writes triage_events (registered, suggested)
and returns the token label, status_code and position. Add a printable token slip with QR to /s/{status_code}.
Keep registration under 60 seconds in a usability test. Add Playwright tests for Token 23 and Token 87.
```
**Acceptance:** Token 87 → red with reason and task; slip prints with QR; server result equals client result; tiles are bilingual.

## Phase 4: Queue engine and nurse dashboard (8-10 h) *(core)*
**Goal:** live lanes, vitals entry, override, reorder, call, emergency transfer.
**Deliverables:** `src/lib/queue.ts` (ordering, fractional reorder, position, ETA, overdue) with tests; `/nurse` with department selector, three lanes, patient cards, vitals/details form (F11), override sheet with reason codes (F12), drag + arrow reorder, call next, send to casualty, Immediate sound/flash, Realtime updates, audit viewer panel per visit.
**Prompt:**
```
Phase 4. Implement the queue maths in src/lib/queue.ts per docs/ARCHITECTURE.md section 5 (ordering by level_rank then
sort_key, fractional-index reorder with renumber fallback, position, ETA range, overdue flags) with unit tests.
Build the nurse dashboard per docs/FEATURES.md F10-F12: department selector, three lanes with counters and level-mix
bar, patient cards (token, age/sex, tile chips, one-line reason, waiting time, Overdue/Revisit/Needs-verification
badges, vitals snapshot, tasks), vitals/details form with plausibility checks that re-runs the server engine and logs
vitals_added, override sheet with reason-code dropdown (raise/lower/either lists), drag handle and up/down arrows
for reorder within a lane (cross-lane moves are overrides requiring a reason), Call, Skip, Send to casualty, and
Change department. Use Supabase Realtime channel queue:{department_id}. Sound + flash on new Immediate. Add
endpoints: PATCH /api/visits/:id/vitals, POST override, reorder, call, status, department. Every action writes
triage_events with actor, from/to, reason_code, rule_version. Enforce: only nurse/doctor can lower; recompute never
undoes a nurse decision. Add Playwright test: register Token 87 -> nurse adds vitals -> override -> reorder -> call.
```
**Acceptance:** dashboard updates in <2 s; audit rows for every action; lowering requires reason; reorder changes one row.

## Phase 5: Departments, doctors and returning patients (5-6 h)
**Goal:** per-department queues, doctor view, patient history and revisit logic.
**Deliverables:** department/room admin basics; token labels per department; doctor view `/doctor` (call next, start, done, refer, follow-up); department transfer with preserved wait; patient search (phone/name/UHID) with pre-fill; conditions persistence (nurse-verified); revisit within 72 h flag and bump; duplicate-today warning; consult duration capture for ETA.
**Prompt:**
```
Phase 5. Implement F8, F2 and F13. Add departments from data/departments.json with independent queues and
token labels like GEN_MED-087 (next_token per department per day). Build /doctor: queue for the doctor's department
with triage reason and vitals, actions Call next / Start / Done / Refer / Follow-up needed; record consult_start and
consult_end and use a rolling average of the last 20 consults per department for ETA (fallback to
departments.avg_consult_minutes) divided by active doctors. Implement department transfer that issues a new token in
the new department but keeps registered_at and sort_key. IMMEDIATE visits route to EMERG (Casualty) but retain the
original department. Build patient search (phone, name with Fuse.js fuzzy, UHID) on the reception screen: selecting a
patient pre-fills demographics, nurse-verified conditions and allergies, shows last visit info, flags revisit within
72 hours (engine bumps one level only if something fired), warns about duplicate active visits today, and supports
shared family phones (phone_is_shared). Add tests for revisit logic, transfer, and ETA maths.
```
**Acceptance:** three departments run independently; returning patient registered in <30 s; revisit badge + bump; transfer preserves wait.

## Phase 6: n8n notifications and public status page (6-8 h) *(core)*
**Goal:** patients are informed in Hindi: N1-N7, status page, QR, display board.
**Deliverables:** `n8n/docker-compose.yml`; workflows WF-0..WF-4 exported to `n8n/workflows/`; `POST /api/notify/render`, `/api/notify/callback`, `/api/notify/link`, `GET /api/queue/watch`; templates in `src/lib/notify/templates.ts` (Hindi + English from docs/N8N_WORKFLOWS.md); dedupe + rate-limit; consent handling; `/s/[code]` page; `/display/[dept]` board.
**Prompt:**
```
Phase 6. Implement notifications per docs/N8N_WORKFLOWS.md. In the app: (1) an event dispatcher that POSTs events to
N8N_WEBHOOK_URL with the X-TL-Secret header on visit_registered, triage_completed, position_changed, near_turn,
called, no_show, delay, immediate_arrival, overdue, emergency_transfer; (2) POST /api/notify/render that returns
{send, channel, to, language, template, text, dedupe_key, fallback_channel} using the templates and wait-reason codes
in the doc, honouring consent, quiet rules, dedupe (notifications.dedupe_key unique), a 10-minute per-patient rate
limit for non-critical messages, and the privacy rule (no symptoms or diagnosis, token + first initial only);
(3) POST /api/notify/callback to store delivery status; (4) GET /api/queue/watch returning threshold events
(position <=3, <=1, worsened by 3+ or ETA +15 min, called but not arrived after 5 min, overdue, Immediate unseen 5 min);
(5) POST /api/notify/link for Telegram deep-link linking. Build the public status page /s/[code] (server-rendered,
light, hi/en, auto-refresh, token + dept + position + ETA range + calm reason, no names) and the waiting-hall board
/display/[dept] (token labels only). Provide n8n/docker-compose.yml and describe how to build WF-0..WF-4 in n8n
(Webhook -> render -> Switch channel -> Telegram/WhatsApp/SMS -> callback, with fallback). Add tests for dedupe,
consent off, template rendering in Hindi and English, and the watch endpoint thresholds.
```
**Acceptance:** N1 arrives <30 s; N2 after nurse saves details; N4/N5 at near/called; duplicate webhook → one message; no PHI in text; status page and display work without login.

## Phase 7: LLM symptom parser and nurse verification (4-5 h)
**Goal:** unique symptoms handled safely.
**Deliverables:** `src/llm/{parser,providers,prompt,schema,guard}.ts`; `/api/llm/parse`; `symptom_proposals` flow; receptionist "Nurse will verify" UI; nurse verify panel (tags, level buttons, add-to-catalogue); admin approval list; 60-phrase eval script.
**Prompt:**
```
Phase 7. Implement docs/LLM_SYMPTOM_PARSER.md. Create a SymptomParser interface with AnthropicParser (model from
ANTHROPIC_MODEL, temperature 0, 4 s timeout, JSON only), OllamaParser and NoopParser selected by LLM_PROVIDER. Build the
system prompt from the doc with ALLOWED_TAGS and ALLOWED_DEPTS injected, wrap text in <patient_text>, cap at 300
chars, validate output with Zod, filter tags to the whitelist, discard invalid items. Only the symptom text is sent.
POST /api/llm/parse is called for leftover text after the keyword matcher. Visits with LLM involvement or unmatched
text get needs_verification=true and at least SOON (engine S-3), tags tagged source=llm (raise-only). Store
symptom_proposals. Build the nurse verify panel: original text, English translation, suggested tag chips, red-dot if
possible_red_flag, final tag selection, level buttons (pre-selected to current; lowering needs reason code),
add-to-catalogue checkbox, Save => verified event, needs_verification=false, engine re-run with nurse tags, N2
triggered. Build the admin list to approve catalogue proposals. Write scripts/llm-eval.ts running 60 phrases
(20 red-flag, 10 injection, 10 nonsense) and reporting red-flag recall, schema violations and injection handling.
```
**Acceptance:** LLM outage → Soon + nurse note; injection phrases ignored; recall ≥ 95% on red-flag set; level never changed by LLM alone.

## Phase 8: Admin, rules transparency, analytics, audit viewer (5-6 h)
**Deliverables:** `/admin/rules` (table, source, status, draft/version/approve, scenario test panel), catalogue manager, departments/rooms/users, settings (time targets, season, notify limits, show-group-to-patient, demo speed), audit viewer + CSV export, analytics page (waits, override rate, level mix, peak hours, notification stats), simulator comparison, daily report workflow WF-4.
**Prompt:**
```
Phase 8. Build the admin area per docs/FEATURES.md F16, F18, F19. Rules page: render data from rule_sets with
ID, level, condition (human readable), reason, concern, pack, source and status; allow editing as a draft, running the
40 scenarios against draft vs active, and approving to create a new version; every visit stores rule_version.
Settings page for time targets, season, notification limits, show_group_to_patient (default off), demo speed.
Audit viewer with filters and CSV export. Analytics with Recharts: visits by level/department, mean and p90 wait by
level, Immediate time-to-nurse, override rate by direction, level-mix over-triage meter, peak hours, notification
delivery, LLM usage and verification rate. Implement scripts/simulate.ts replaying 200 synthetic arrivals under FIFO
vs TriageLane with identical arrival times and doctor capacity, printing Immediate wait statistics, and surface it
on the analytics page labelled "synthetic simulation". Add the daily report n8n workflow spec.
```
**Acceptance:** editing a rule creates a new version; scenarios pass before approval; simulator output matches expectations; CSV export opens in Excel.

## Phase 9: Hindi polish, offline PWA, accessibility (4-5 h)
**Deliverables:** complete hi/en strings; Noto Sans Devanagari; large-text and high-contrast modes; PWA with Serwist; cached shell/catalogue/rules; Dexie outbox and sync UI; offline client engine path; Lighthouse PWA/accessibility pass; Marwari-friendly synonym additions with local staff.
**Prompt:**
```
Phase 9. Finish localisation: every user-facing string in messages/hi.json and en.json, Devanagari font loaded
locally, language toggle persisted per user. Implement the PWA with Serwist caching the app shell, data/*.json and
fonts. Implement the offline outbox with Dexie: when offline, run the client engine, store the visit with a client
UUID and local token label (OFFLINE-xx), print a slip without QR, and sync via POST /api/visits on reconnect; the
server recomputes and issues the real token; show a sync indicator and alert if the server level is higher. Add
large-text and high-contrast modes, ensure levels use icon + label + colour, touch targets 48px+, keyboard
navigation. Add Playwright tests with network offline. Target Lighthouse accessibility >= 90 and PWA installable.
```
**Acceptance:** airplane-mode registration works and syncs; server level ≥ client; Hindi coverage 100%.

## Phase 10: Hardening, demo and pitch (4-6 h)
**Deliverables:** seed + reset demo, demo mode banner, timers speed-up, rehearsal script, backup video, README screenshots, slide deck, final safety review, load smoke test, bug bash.
**Prompt:**
```
Phase 10. Prepare for the demo. Add a demo mode (env flag) with a banner "Demo data, not real patients", a reset
button (admin only, demo mode only) that reseeds, and a timer speed-up multiplier. Script the 6-7 minute demo from
docs/SAFETY_PRIVACY_TESTING.md section 6 as a Playwright "demo run" that I can also follow by hand. Run a full safety
review against the S-1..S-12 invariants and list evidence (test names) for each. Run a smoke load test (50 concurrent
registrations) and fix issues. Check privacy: no PHI in notifications, status page and display; service key never
exposed. Add README screenshots placeholders, a LICENSE, and a known-limitations section (clinical validation pending,
WhatsApp templates and SMS DLT for production, synthetic data only). Produce a checklist for the live demo including
a fallback plan (recorded video, local Ollama, Telegram instead of WhatsApp).
```
**Acceptance:** full demo runs 3 times without error; every invariant has a passing test; fallback plan ready.

---
# PART C: HANDY SMALL PROMPTS

**Review prompt (run after each phase):**
```
Act as a clinical-safety and security reviewer. Check this phase's diff against the safety invariants in the master
prompt, docs/TRIAGE_ENGINE.md and docs/SAFETY_PRIVACY_TESTING.md. List violations, missing tests, privacy leaks in
notifications, role-check gaps and any place the LLM could influence priority. Propose minimal fixes.
```

**Bug triage prompt:**
```
Reproduce the bug with a failing test first, then fix it, then run the full suite. Explain root cause in two sentences.
```

**Rule-edit prompt (for MBBS teammates via a developer):**
```
Update data/rules.json: change rule <ID> as described, bump the rule version, add or update scenarios in the test table
for the new behaviour, run the engine tests, and show the diff of reason strings in Hindi and English.
```

**Demo-data prompt:**
```
Generate 60 synthetic patients with realistic Jodhpur-area Hindi names, ages, sexes, fake phone numbers, localities
and a mix of conditions; create 30 visits across departments with a realistic level mix (about 8% Immediate,
25% Soon, 67% Routine). No real data.
```
