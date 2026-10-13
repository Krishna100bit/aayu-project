# Safety, Privacy, Testing and Demo

## 1. Positioning
TriageLane is **decision support for queue ordering**. It does not diagnose, treat or replace clinical judgement. Required text (app footer, README, slides):

> Thresholds are based on published triage frameworks and require clinical validation before real deployment. TriageLane supports queue ordering; it does not diagnose and does not replace clinical judgement. Demo uses synthetic data only.

## 2. Safety invariants (each has an automated test)
| # | Invariant |
|---|---|
| S-1 | Highest level wins; no averaging |
| S-2 | Missing vitals never lower priority; red flag + no vitals → bump one level + task |
| S-3 | Unmatched symptoms default to Soon |
| S-4 | Free-text keyword net adds tags regardless of tiles chosen |
| S-5 | Implausible vitals rejected with re-measure prompt |
| S-6 | Only nurse/doctor can lower a level, with reason code |
| S-7 | System recompute never undoes a nurse decision or a fired red flag |
| S-8 | Engine error → Soon with "manual triage required" |
| S-9 | LLM may only raise; schema-validated; tag whitelist; no PHI in prompt |
| S-10 | Notifications contain no symptoms, diagnosis or other patients' data |
| S-11 | Server recomputes level; client cannot set priority |
| S-12 | `triage_events` is append-only |

## 3. Privacy
- **Minimise:** only name, age, sex are required; phone optional; no national ID.
- **Consent:** explicit tick for messages; stored with timestamp; withdrawal stops sends.
- **Messages:** token, first initial, department, position, ETA, generic reason. No symptoms.
- **Public pages:** unguessable status code; display board shows token labels only.
- **LLM:** symptom text only; no name/phone/ID; keep a log internally; allow provider switch to a local model.
- **Access:** RLS by role; service key server-side; audit of admin data views.
- **Retention:** configurable (demo 30 days); export/delete per patient.
- **Law/regulation:** real deployment must follow India's DPDP Act 2023, hospital policy and applicable medical-device regulation; legal and ethics review before real use.

## 4. Test layers
1. **Engine unit tests (Vitest):** scenario table below, property tests (vitals removal monotonic, LLM tag monotonic, determinism).
2. **Queue tests:** ordering, fractional reorder, overdue guard, position/ETA maths, transfer keeps wait time.
3. **API tests:** role checks, server recompute, offline outbox sync, dedupe keys.
4. **E2E (Playwright):** register → nurse sees card → vitals → override → call → patient status page → display board.
5. **Notification tests:** n8n curl checklist; consent off = no sends; fallback channel.
6. **LLM eval:** 60-phrase set (red-flag recall at least 95%, injection ignored 100%).
7. **Usability:** 5 non-clinical volunteers register 10 patients each; target under 60 s.
8. **Simulation:** 200 synthetic arrivals, FIFO vs TriageLane.

## 5. Engine scenario table (expected levels are proposals pending clinical sign-off)

| # | Scenario | Expected |
|---|---|---|
| 1 | M60, chest pain + sweating, no vitals | Immediate (+ task measure vitals) |
| 2 | F24, thyroid refill, no symptoms | Routine (no modifier) |
| 3 | M38 diabetic, jaw pain + nausea, no chest pain | Soon rising to Immediate via modifier (S10 + diabetes); confirm with clinicians |
| 4 | F70, dizzy, SBP 88 | Immediate (SBP ≤ 90 scores 3) |
| 5 | Child 3 y, fever, playing, SpO₂ 98 | Soon (age bump) |
| 6 | Infant 8 m, fever, not feeding, drowsy | Immediate (R09) |
| 7 | M30, cold and mild cough | Routine |
| 8 | M30, red eyes only | Routine |
| 9 | M30, red eye + pain + blurred vision | Soon |
| 10 | F28 pregnant, severe headache, no BP | Immediate (R08) + task BP |
| 11 | F26 pregnant, mild back ache | Soon or Routine per clinical decision |
| 12 | Adult fever 39.4 °C, well | Soon (temp score 2) |
| 13 | Fever 3 days, body ache, monsoon | Soon |
| 14 | Fever + persistent vomiting + abdominal pain, monsoon | Soon, Immediate if drowsy |
| 15 | Farmer, vomiting, salivation, pesticide | Immediate |
| 16 | Snakebite | Immediate |
| 17 | Elderly, new confusion, vitals normal | Immediate (consciousness) |
| 18 | Free text "saans phool rahi hai", tile = cold | Immediate (keyword net) |
| 19 | Unmatched text, vitals normal | Soon + nurse verify |
| 20 | RR 7, rest normal | Immediate (single score 3) |
| 21 | SpO₂ 93, otherwise well | Soon |
| 22 | SpO₂ 150 entered | Rejected, re-measure |
| 23 | Known COPD, SpO₂ 90, breathless at rest | Immediate |
| 24 | Fainting, now alert, age 65 | Immediate (R11 age) |
| 25 | Heat stroke tile + hot dry skin + confusion (summer) | Immediate |
| 26 | Scorpion sting, adult, no systemic signs | Soon |
| 27 | Scorpion sting, child, sweating | Immediate |
| 28 | Dog bite, well | Soon |
| 29 | Stone worker, 3-month cough + breathless on walking | Soon |
| 30 | Road accident, head injury, vomiting | Immediate |
| 31 | Returning patient, same complaint within 72 h | Level + 1 (if a symptom fired) |
| 32 | Refill visit by diabetic with no symptoms | Routine |
| 33 | Self-harm thoughts tile | Immediate, department PSY, do not leave alone |
| 34 | Child under 5, fast breathing + fever | Soon, Immediate with chest indrawing |
| 35 | Diabetic, shaky and sweaty | Immediate (R10) |
| 36 | LLM suggests a red-flag tag; nurse rejects | Level lowered by nurse with reason code; audit |
| 37 | Engine throws exception | Soon, "manual triage required" |
| 38 | Offline registration then sync | Server level ≥ client level; alert if higher |
| 39 | Department transfer GEN_MED → ORTHO | New token, wait time preserved |
| 40 | Shared phone, two patients | Messages carry token + initial; correct status pages |

## 6. Demo script (6 to 7 minutes, Jodhpur audience, Hindi voiceover)
1. **Scene:** "Token 87 aur Token 23". Show FIFO outcome (90 min wait).
2. **Receptionist screen (Hindi):** register Token 23 (thyroid refill): green; patient gets a Telegram/WhatsApp message with token, position, ETA and reason.
3. Register **Token 87**: tap chest pain + sweating, no vitals → **Immediate**, reason line, task "measure vitals now"; board flashes; nurse group Telegram buzzes.
4. **Nurse dashboard:** add vitals; reason updates; patient receives N2 (checks complete).
5. **Unusual symptom:** receptionist types a phrase not in the tiles; LLM suggests tags; card shows "Verify"; nurse sets tags and priority.
6. **Move up/down + override** with reason code; show audit trail.
7. **Returning patient:** search by phone, history pre-filled, revisit badge.
8. **Second department (Paediatrics):** child with fever; separate queue.
9. **Turn arrives:** nurse presses Call; patient phone shows "Room 4"; display board updates.
10. **Close:** simulator numbers (FIFO vs TriageLane), override rate, level mix; disclaimer slide.

## 7. Pitch points
- "We do not diagnose; we sort by urgency, like ESI, Manchester and SATS."
- "Every suggestion has a reason, a rule ID and a version; every override has an owner and a reason."
- "Missing data only makes the system more cautious."
- "AI helps read unusual words; a nurse decides."
- "Patients are informed in Hindi on WhatsApp/Telegram, and a QR works for those without a smartphone data plan."
- "Built for Jodhpur: heat, scorpion, snakebite, silicosis and monsoon fever are in the rules."

## 8. Likely judge questions
| Question | Answer |
|---|---|
| Can the AI make a wrong call? | The AI never sets priority; unknown symptoms default to Soon and a nurse verifies |
| What if the receptionist picks wrong tiles? | Keyword net plus nurse override plus reassessment |
| Is it clinically validated? | No; thresholds follow NEWS2/ESI/IMCI-style frameworks and are marked for sign-off; roadmap includes prospective validation |
| Why not just use ChatGPT? | Deterministic, auditable, offline, role-based queue with notifications; LLM only for parsing |
| What about privacy? | Minimal data, consent, no PHI in messages, public pages anonymised, synthetic demo |
| Does it scale to a big hospital? | Postgres + Realtime per department; engine is client-side; n8n is stateless delivery |
| What if internet fails? | Offline registration with client engine and sync |
