# n8n Workflows

n8n handles **delivery, scheduling and escalation**. All message wording, privacy filtering and channel choice are computed by the app (`POST /api/notify/render`), so workflows stay thin and replaceable.

## 1. Setup

```yaml
# n8n/docker-compose.yml
services:
  n8n:
    image: n8nio/n8n:latest
    ports: ["5678:5678"]
    environment:
      - N8N_HOST=localhost
      - WEBHOOK_URL=http://localhost:5678/          # use your ngrok/cloudflared URL for demos
      - GENERIC_TIMEZONE=Asia/Kolkata
      - TZ=Asia/Kolkata
      - N8N_ENCRYPTION_KEY=change-me
    volumes: ["n8n_data:/home/node/.n8n"]
volumes: { n8n_data: {} }
```

Credentials to create in n8n: **Telegram** (bot token), **WhatsApp Business Cloud** (token + phone number ID) or **Twilio**, an SMS provider via HTTP Request, **HTTP Header Auth** named `TL Secret` (`X-TL-Secret`).
Pin the n8n image version before the demo and export workflows to `n8n/workflows/*.json` (Workflows → Download).

## 2. Event contract (app → n8n)

`POST {N8N_WEBHOOK_URL}` with header `X-TL-Secret`:

```json
{ "event": "visit_registered | triage_completed | position_changed | near_turn | called | no_show | delay | immediate_arrival | overdue | emergency_transfer",
  "visit_id": "uuid", "department_id": "GEN_MED", "occurred_at": "2026-10-13T10:15:00+05:30" }
```

`POST /api/notify/render` response:

```json
{ "send": true, "channel": "whatsapp", "to": "+91XXXXXXXXXX", "language": "hi",
  "template": "N1_registered", "text": "...final text...", "dedupe_key": "visit|N1|3", "fallback_channel": "sms" }
```
If `send` is false (no consent, deduped, rate-limited) n8n stops.

## 3. Workflows

### WF-0 Telegram linking (demo-friendly, no WhatsApp approval)
Trigger: **Telegram Trigger** (`/start <status_code>`) → HTTP `POST /api/notify/link {status_code, chat_id}` → reply "Linked. You will receive updates for token X."
QR on the slip can be a deep link `https://t.me/<bot>?start=<status_code>` as well as the status page link.

### WF-1 Patient notifications
`Webhook` → `IF secret ok` → `HTTP Request: render` → `IF send` → `Switch: channel`
- whatsapp → **WhatsApp Business Cloud** (template message)
- telegram → **Telegram** (chat_id)
- sms → HTTP Request to the SMS provider
→ `HTTP Request: /api/notify/callback {status, provider_id}`.
Error output of each send node → **fallback_channel** attempt → callback with `failed` if both fail.

### WF-2 Staff alerts
Event `immediate_arrival` / `emergency_transfer` / `overdue` → Telegram **staff group** message:
`RED  GEN_MED-087  M60  Chest tightness + sweating; vitals missing: measure BP, pulse, SpO2 now.` (no names).
Optional: second alert to the duty doctor if unseen in 5 minutes.

### WF-3 Queue watcher (cron, every minute)
`Schedule Trigger` → `HTTP GET /api/queue/watch` → returns events like
`[{event:'near_turn', visit_id}, {event:'position_changed', visit_id, delta:+4}, {event:'no_show', visit_id}, {event:'overdue', visit_id}, {event:'immediate_unseen_5min', visit_id}]`
→ `Split In Batches` → route each to WF-1 or WF-2 by `event`.
Thresholds live in `app_settings` and are enforced in the app (n8n does not decide).

### WF-4 Daily report
`Schedule Trigger (18:00)` → `GET /api/analytics?range=today` → build message/HTML → Telegram/email to admin: visits by level and dept, mean and 90th percentile wait by level, overrides (raise/lower), notifications delivered, Immediate time-to-nurse.

### WF-5 (stretch) Revisit and feedback
After `done`, wait 2 hours → send feedback link; if `follow_up_needed`, send a reminder before the follow-up date.

## 4. Patient message templates (rendered by the app)

Placeholders: `{hospital} {dept} {token} {pos} {eta_min} {eta_max} {reason} {room} {link} {first_initial}`.
Every message starts with the **token and first initial** so shared family phones are unambiguous.

| ID | When | English | Hindi |
|---|---|---|---|
| N1 registered | After receptionist saves | "{hospital}: Token {token} ({first_initial}) is registered for {dept}. Queue number: {pos}. Estimated wait: {eta_min}-{eta_max} min (may change if emergencies arrive). Live status: {link}" | "{hospital}: टोकन {token} ({first_initial}) {dept} के लिए दर्ज हुआ। कतार में नंबर: {pos}। अनुमानित प्रतीक्षा: {eta_min}-{eta_max} मिनट (आपातकालीन मरीज़ आने पर बदल सकती है)। लाइव स्थिति: {link}" |
| N2 triage done | Nurse saved vitals/details or verified symptom | "Token {token}: your checks are complete. You are now number {pos}. Estimated wait {eta_min}-{eta_max} min. Reason: {reason}" | "टोकन {token}: आपकी जाँच पूरी हुई। अब आपका नंबर {pos} है। अनुमानित प्रतीक्षा {eta_min}-{eta_max} मिनट। कारण: {reason}" |
| N3 delay | Position worse by 3+ or ETA +15 min | "Update for token {token}: emergency patients are being treated, so the wait is longer. New estimate {eta_min}-{eta_max} min. Thank you for your patience." | "टोकन {token} के लिए सूचना: आपातकालीन मरीज़ों का इलाज चल रहा है, इसलिए प्रतीक्षा कुछ लंबी है। नया अनुमान {eta_min}-{eta_max} मिनट। धैर्य के लिए धन्यवाद।" |
| N4 near | Position <= 3 (once), <= 1 | "Token {token}: your turn is near (number {pos}). Please stay in the {dept} waiting area." | "टोकन {token}: आपका नंबर पास है (नंबर {pos})। कृपया {dept} प्रतीक्षा क्षेत्र में रहें।" |
| N5 called | Nurse/doctor calls | "Token {token}: it is your turn. Please go to {room} now." | "टोकन {token}: आपकी बारी है। कृपया अभी {room} में जाएँ।" |
| N6 no-show | 5 min after call | "Token {token}: we called you to {room}. Please come within 5 minutes or meet the nurse." | "टोकन {token}: हमने आपको {room} में बुलाया था। कृपया 5 मिनट में आएँ या नर्स से मिलें।" |
| N7 attendant | Immediate with phone | "Token {token}: please come to the nurse station now." | "टोकन {token}: कृपया अभी नर्स स्टेशन पर आएँ।" |

### Wait reasons (`{reason}`), generic and calm
| Code | English | Hindi | Used when |
|---|---|---|---|
| `ORDERED_BY_NEED` | "Your visit is being arranged by medical need." | "आपकी जाँच चिकित्सकीय ज़रूरत के अनुसार तय की जा रही है।" | Soon level, or position affected by priority |
| `EMERGENCY_FIRST` | "Patients with urgent conditions are being seen first." | "गंभीर स्थिति वाले मरीज़ों को पहले देखा जा रहा है।" | Emergencies ahead |
| `IN_ORDER` | "Patients are being seen in order." | "मरीज़ों को क्रम से देखा जा रहा है।" | Routine, normal flow |
| `NURSE_CHECK_PENDING` | "A nurse will check you before the doctor." | "डॉक्टर से पहले नर्स आपकी जाँच करेंगी।" | Status registered/with_nurse |
| `DOCTOR_BUSY` | "The doctor is with another patient." | "डॉक्टर अभी दूसरे मरीज़ को देख रहे हैं।" | Position 1 waiting |

Setting `show_group_to_patient` (default **off**) can add "Your group: Priority / Normal"; the colour names Red/Amber/Green are never sent.

## 5. Delivery notes
- **Telegram:** free, instant; patient must press Start (deep link on QR). Best for the live demo.
- **WhatsApp Cloud API:** the first business-initiated message must be an approved **template**; the test number can message a small list of verified recipients; production needs a verified business. Keep templates generic (utility category).
- **SMS in India:** production use needs DLT registration of the sender ID and templates; for the demo mention it as a roadmap item.
- **Consent:** no message without `consent_notify`. QR slip always works.
- **Idempotency:** `notifications.dedupe_key` is unique; n8n retries are safe.

## 6. Test with curl
```bash
curl -X POST "$N8N_WEBHOOK_URL" -H "Content-Type: application/json" -H "X-TL-Secret: $N8N_SHARED_SECRET" \
  -d '{"event":"visit_registered","visit_id":"<uuid>","department_id":"GEN_MED","occurred_at":"2026-10-13T10:15:00+05:30"}'
```
Checklist: message arrives in under 30 s; duplicate call produces no second message; disabling consent stops sends; killing the WhatsApp credential triggers the fallback channel.
