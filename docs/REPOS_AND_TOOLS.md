# Repos, Starters and Services to Reuse

Always check each repo's licence, last commit and open issues before depending on it. Names below are the canonical GitHub paths as best known; verify they still resolve.

## 1. Start from these
| What | Repo / command | Use |
|---|---|---|
| Next.js + Supabase starter | `npx create-next-app@latest -e with-supabase` (Vercel's official example) | Auth, SSR client, env wiring already done |
| shadcn/ui | `shadcn-ui/ui` | Buttons, dialogs, sheets, tables, toasts (`npx shadcn@latest init`) |
| Admin dashboard template (optional) | `Kiranism/next-shadcn-dashboard-starter` or `satnaing/shadcn-admin` | Layout, sidebar, tables to adapt for nurse/admin screens |
| Supabase | `supabase/supabase` (CLI: `supabase init`, `supabase start` for local Docker) | Local DB, Realtime, Auth |
| n8n | `n8n-io/n8n` and Docker image `n8nio/n8n` | Automation; browse community workflows at n8n.io/workflows for Telegram/WhatsApp patterns |

## 2. Libraries
| Need | Repo | Notes |
|---|---|---|
| Drag-and-drop reorder | `clauderic/dnd-kit` | Sortable lists with keyboard support |
| i18n | `amannn/next-intl` | Hindi/English messages |
| PWA / service worker | `serwist/serwist` | Modern replacement for `next-pwa` |
| IndexedDB | `dexie/Dexie.js` | Offline outbox |
| Validation | `colinhacks/zod` | Shared schemas |
| Fuzzy search | `krisk/Fuse` | Symptom and patient search |
| Charts | `recharts/recharts` | Analytics |
| Icons | `lucide-icons/lucide` | Symptom tile icons |
| Forms | `react-hook-form/react-hook-form` | Registration forms |
| Server state | `TanStack/query` | Cache + Realtime invalidation |
| QR codes | `soldair/node-qrcode` | Token slip |
| Dates | `date-fns/date-fns` | Waiting time formatting |
| Tests | `vitest-dev/vitest`, `microsoft/playwright` | Engine scenarios and end-to-end flows |
| Rules (optional) | `CacheControl/json-rules-engine` | Alternative if you prefer a library over our own evaluator |

## 3. AI / language
| Need | Repo / service | Notes |
|---|---|---|
| Hosted small LLM | Anthropic API (Claude Haiku) | Default parser; strict JSON output |
| Local LLM fallback | `ollama/ollama` with `qwen2.5:3b` or `llama3.2:3b` | Offline demo; weaker at Hindi |
| Browser speech | Web Speech API (`hi-IN`) | No dependency; Chrome/Android works best |
| Indic NLP (stretch) | `AI4Bharat` projects (IndicTrans2, IndicWhisper) | Transliteration/ASR if time permits |

## 4. Messaging
| Channel | Service | Notes |
|---|---|---|
| Telegram | BotFather bot + n8n Telegram node | Free; best for live demo; patient taps Start via QR deep link |
| WhatsApp | Meta WhatsApp Cloud API (n8n "WhatsApp Business Cloud" node) or Twilio sandbox | Template messages; test number for demo |
| SMS | MSG91, Fast2SMS or Twilio | Indian production SMS needs DLT registration |
| Unofficial WhatsApp gateways (e.g. `devlikeapro/waha`) | Hackathon-only experiments | Violates WhatsApp terms in production; do not rely on it in the demo narrative |

## 5. Clinical knowledge sources (for the MBBS team to check the rules against)
- Royal College of Physicians, **NEWS2** (2017) chart and guidance
- Emergency Nurses Association, **ESI Handbook v5**
- Manchester Triage System; South African Triage Scale (SATS)
- WHO **IMCI** danger signs; WHO dengue warning signs
- Obstetric early warning (MEOWS) and severe hypertension in pregnancy guidance
- Hospital's own OPD protocols (always override these)

## 6. Folder to copy into your repo
`data/`, `db/schema.sql`, `docs/`, `.env.example`, `MASTER_PROMPT.md` from this package.
