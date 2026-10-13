# TriageLane

**Sickest first, not first come.**
A safe, explainable, auditable patient-priority queue for government hospital OPDs, built for a medical AI hackathon (Problem Statement T05: OPD Flow) and designed for a Jodhpur-style crowded OPD.

> **Disclaimer.** TriageLane is *decision support for queue ordering*. It does not diagnose and does not replace nurses or doctors. All thresholds come from published triage frameworks and need clinical validation before any real-world use. Use synthetic data only.

---

## 1. What it does (one minute)

1. **Receptionist** registers the patient (name, age, sex, phone) and taps big symptom tiles (Hindi/English, voice optional). A pre-built catalogue means almost no typing.
2. A **deterministic rule engine** suggests **Immediate / Soon / Routine**, a one-line reason, a **suggested department**, and "do now" tasks (e.g. *measure BP and SpO2 now*).
3. The patient gets a **WhatsApp / Telegram / SMS message through n8n** with token number, queue position, estimated wait and the **reason for the wait**. A QR code opens a no-login live status page.
4. **Nurse dashboard** per department: add vitals and details, verify unusual symptoms, **move patients up or down**, override priority with a reason code, send to casualty.
5. For **unique symptoms** typed in free text, a **small LLM** only *suggests tags*; the visit is flagged **"needs nurse verification"**, defaults to at least *Soon*, and the **nurse confirms and sets the priority**.
6. **Returning patients** are found by phone / name / OPD card number; history, chronic conditions and prior flags are pre-filled; revisit-within-72-hours is flagged.
7. **Multiple departments** have their own queues and rooms; **Immediate** cases go to casualty regardless of department.
8. When the **turn comes**, n8n notifies the patient ("Room 4, Dr. ___, please come now") and the waiting-hall display updates.
9. Everything is in an **append-only audit trail**; an **analytics page** shows waits, override rate and level mix.

---

## 2. Tech stack (chosen for speed and simplicity)

| Layer | Choice | Why |
|---|---|---|
| App | **Next.js 15 (App Router) + TypeScript** | One codebase for UI and API routes |
| UI | **Tailwind CSS + shadcn/ui + lucide-react** | Fast, clean, accessible components and icons |
| Data + Auth + Realtime | **Supabase** (Postgres, Auth, Realtime, RLS) | Live dashboards with almost no backend code |
| Rule engine | Pure **TypeScript** module + `data/rules.json`, tested with **Vitest** | Deterministic, offline-capable, explainable |
| Reorder UI | **dnd-kit** | Drag and drop plus keyboard up/down |
| i18n | **next-intl** (Hindi first, English) | Local-language UI |
| Offline | **Serwist (PWA)** + **Dexie (IndexedDB)** | Registration keeps working without internet |
| Automation | **n8n** (self-hosted Docker) | Notifications, escalations, reports |
| Messaging | Telegram bot (free, demo), WhatsApp Cloud API, SMS (MSG91/Fast2SMS) | Channels patients actually use |
| LLM | **Claude Haiku** via API, or **Ollama** (local) fallback | Parses odd free text into tag suggestions only |
| Hosting | Vercel + Supabase cloud + n8n on a small VPS or laptop | Free tiers are enough for a demo |

Details and alternatives: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md). Reusable repos: [`docs/REPOS_AND_TOOLS.md`](docs/REPOS_AND_TOOLS.md).

---

## 3. Architecture at a glance

```mermaid
flowchart LR
  R[Receptionist app] -->|visit + symptoms| API[Next.js API routes]
  API --> ENG[Triage engine (pure TS)]
  API --> DB[(Supabase Postgres + Realtime)]
  API -->|free text only| LLM[LLM parser (suggest tags)]
  DB -->|Realtime| N[Nurse dashboard]
  DB -->|Realtime| D[Doctor view]
  DB -->|Realtime| DISP[Waiting-hall display]
  DB -->|DB webhook / events| N8N[n8n workflows]
  N8N --> TG[Telegram]
  N8N --> WA[WhatsApp]
  N8N --> SMS[SMS]
  N8N -->|log + render endpoint| API
  P[Patient phone] -->|QR / link| ST[Public status page]
  ST --> API
```

---

## 4. Roles and screens

| Role | Screens |
|---|---|
| Receptionist | Register / find patient, symptom tiles, free text + voice, department confirm, token slip with QR |
| Nurse | Department queue (3 lanes), patient card, vitals + details form, verify LLM suggestions, override, reorder, call next, send to casualty |
| Doctor | My queue, call next / done, see triage reason and vitals |
| Admin | Rule viewer/editor with versions, symptom catalogue, departments and rooms, users, settings, analytics, audit viewer |
| Patient (no login) | Status page via QR/link, notifications |
| Public screen | Waiting-hall display: token numbers and "now serving" only |

---

## 5. Repository layout (target)

```
triagelane/
├─ README.md
├─ MASTER_PROMPT.md            # phased build prompts for an AI coding agent
├─ docs/                       # PRD, architecture, features, engine, n8n, repos, safety
├─ db/schema.sql               # Postgres schema, RLS sketch
├─ data/                       # symptoms.json, tags.json, rules.json, departments.json
├─ src/
│  ├─ app/                     # Next.js routes: (reception) (nurse) (doctor) (admin) s/[code] display/[dept] api/*
│  ├─ engine/                  # pure triage engine (no framework imports) + tests
│  ├─ lib/                     # supabase client, queue math, i18n, offline outbox
│  ├─ components/              # symptom tiles, queue lanes, patient card, override sheet
│  └─ llm/                     # parser prompt, guardrails, providers
├─ n8n/                        # exported workflow JSON + docker-compose
└─ scripts/                    # seed, simulator, demo data
```

---

## 6. Quick start

```bash
# 1. scaffold (or clone your repo once Phase 0 is done)
npx create-next-app@latest triagelane -e with-supabase
cd triagelane && pnpm add zod dexie @dnd-kit/core @dnd-kit/sortable next-intl lucide-react recharts fuse.js qrcode
pnpm add -D vitest

# 2. environment
cp .env.example .env.local        # fill Supabase keys

# 3. database
#   Supabase dashboard -> SQL editor -> paste db/schema.sql
pnpm tsx scripts/seed.ts          # loads data/*.json, creates demo users and 60 demo patients

# 4. n8n (notifications)
docker compose -f n8n/docker-compose.yml up -d     # http://localhost:5678
#   import workflows from n8n/workflows/*.json, set credentials, activate

# 5. run
pnpm dev                          # http://localhost:3000
pnpm test                         # engine tests (must pass before any demo)
```

Demo logins (seeded): `reception@demo`, `nurse.med@demo`, `doctor.med@demo`, `admin@demo` (passwords in seed script output).

---

## 7. Documentation index

| Doc | Contents |
|---|---|
| [`docs/PRD.md`](docs/PRD.md) | Vision, personas, user stories, functional and non-functional requirements, metrics, scope |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Stack decisions, components, queue algorithm, ETA model, API, realtime, offline, security |
| [`docs/FEATURES.md`](docs/FEATURES.md) | Every feature with behaviour, edge cases and acceptance criteria |
| [`docs/TRIAGE_ENGINE.md`](docs/TRIAGE_ENGINE.md) | Rules, vitals scoring, modifiers, safety invariants, pseudo-code, department routing |
| [`docs/LLM_SYMPTOM_PARSER.md`](docs/LLM_SYMPTOM_PARSER.md) | Small-LLM design, prompt, guardrails, nurse verification loop |
| [`docs/N8N_WORKFLOWS.md`](docs/N8N_WORKFLOWS.md) | Workflows, payloads, message templates (Hindi + English), setup |
| [`docs/REPOS_AND_TOOLS.md`](docs/REPOS_AND_TOOLS.md) | Repos, starters and services to reuse |
| [`docs/SAFETY_PRIVACY_TESTING.md`](docs/SAFETY_PRIVACY_TESTING.md) | Safety invariants, privacy, test scenarios, demo script, pitch points |
| [`MASTER_PROMPT.md`](MASTER_PROMPT.md) | Master prompt plus phase-by-phase prompts |

---

## 8. Status

Draft v0.1 prepared 2026-10-13. Rules are a starter set marked `clinical_signoff_pending`.
