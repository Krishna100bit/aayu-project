import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import departmentsData from "../data/departments.json";
import rulesData from "../data/rules.json";
import symptomsData from "../data/symptoms.json";
import tagsData from "../data/tags.json";

// Read .env.local manually if running outside Next.js
function loadEnv() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, "utf-8").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const [key, ...rest] = trimmed.split("=");
      if (key && rest.length > 0) {
        process.env[key.trim()] = rest.join("=").trim().replace(/^"(.*)"$/, "$1");
      }
    }
  }
}

loadEnv();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function seed() {
  console.log("🌱 Starting TriageLane Supabase Database Seed...");

  // 1. Seed departments
  console.log("1. Seeding departments...");
  for (const dept of departmentsData.departments) {
    const { error } = await supabase.from("departments").upsert({
      id: dept.id,
      name_en: dept.name_en,
      name_hi: dept.name_hi,
      avg_consult_minutes: dept.avg_consult_minutes,
      is_emergency: dept.id === "EMERG",
      active: true,
    });
    if (error) console.error(`Error inserting department ${dept.id}:`, error.message);
  }
  console.log(`✓ ${departmentsData.departments.length} departments seeded.`);

  // 2. Seed rooms (2 rooms per department)
  console.log("2. Seeding rooms...");
  const { data: existingRooms } = await supabase.from("rooms").select("department_id, label");
  const existingSet = new Set((existingRooms || []).map((r) => `${r.department_id}:${r.label}`));

  for (const dept of departmentsData.departments) {
    if (dept.id === "EMERG") continue;
    for (let r = 1; r <= 3; r++) {
      const key = `${dept.id}:Room ${r}`;
      if (!existingSet.has(key)) {
        await supabase.from("rooms").insert({
          department_id: dept.id,
          label: `Room ${r}`,
          active: true,
        });
      }
    }
  }
  console.log("✓ Rooms seeded.");

  // 3. Seed rule sets
  console.log("3. Seeding rule sets...");
  const { error: ruleErr } = await supabase.from("rule_sets").upsert({
    version: rulesData.version,
    definition: rulesData,
    status: "approved",
  });
  if (ruleErr) console.error("Error inserting rule set:", ruleErr.message);
  console.log(`✓ Rule set v${rulesData.version} seeded.`);

  // 4. Seed symptom tags
  console.log("4. Seeding symptom tags...");
  const tagUpserts: Array<{
    id: string;
    en: string;
    hi: string;
    is_tile: boolean;
    suggested_dept?: string;
    red_flag_candidate: boolean;
    synonyms: string[];
    status: string;
  }> = [];

  for (const tile of symptomsData.tiles) {
    tagUpserts.push({
      id: tile.id,
      en: tile.en,
      hi: tile.hi,
      is_tile: true,
      suggested_dept: tile.suggested_dept,
      red_flag_candidate: Boolean(tile.red_flag_candidate),
      synonyms: tile.synonyms || [],
      status: "approved",
    });
  }

  for (const tag of tagsData.tags) {
    if (!tagUpserts.some((t) => t.id === tag.id)) {
      tagUpserts.push({
        id: tag.id,
        en: tag.en,
        hi: tag.hi,
        is_tile: false,
        red_flag_candidate: false,
        synonyms: [],
        status: "approved",
      });
    }
  }

  for (const chunk of chunkArray(tagUpserts, 50)) {
    const { error: tagErr } = await supabase.from("symptom_tags").upsert(chunk);
    if (tagErr) console.error("Error inserting tags chunk:", tagErr.message);
  }
  console.log(`✓ ${tagUpserts.length} symptom tags seeded.`);

  // 5. Seed app settings
  console.log("5. Seeding app settings...");
  const settings = [
    { key: "hospital_name", value: "Demo District Hospital, Jodhpur" },
    { key: "escalation_minutes", value: { IMMEDIATE: 5, SOON: 30, ROUTINE: 120 } },
    { key: "season", value: "normal" },
    { key: "active_rule_version", value: rulesData.version },
    { key: "notify_max_per_hour", value: 3 },
  ];
  for (const s of settings) {
    await supabase.from("app_settings").upsert(s as unknown as Record<string, unknown>);
  }
  console.log("✓ App settings seeded.");

  // 6. Seed Demo Patients (including Token 87 and Token 23)
  console.log("6. Seeding synthetic demo patients...");
  const demoPatients = [
    {
      uhid: "UHID-2026-087",
      full_name: "Rameshwar Prasad",
      sex: "M",
      birth_year: 1968,
      age_years_at_registration: 58,
      phone: "9829012345",
      language: "hi",
    },
    {
      uhid: "UHID-2026-091",
      full_name: "Kamla Devi",
      sex: "F",
      birth_year: 1959,
      age_years_at_registration: 67,
      phone: "9829054321",
      language: "hi",
    },
    {
      uhid: "UHID-2026-042",
      full_name: "Aarav Sharma",
      sex: "M",
      birth_year: 2023,
      age_years_at_registration: 3,
      phone: "9876543210",
      language: "hi",
    },
    {
      uhid: "UHID-2026-015",
      full_name: "Suraj Mal Gehlot",
      sex: "M",
      birth_year: 1952,
      age_years_at_registration: 74,
      phone: "9414011223",
      language: "hi",
    },
    {
      uhid: "UHID-2026-023",
      full_name: "Sunita Choudhary",
      sex: "F",
      birth_year: 1992,
      age_years_at_registration: 34,
      phone: "9166099887",
      language: "hi",
    },
    {
      uhid: "UHID-2026-004",
      full_name: "Pooja Bishnoi",
      sex: "F",
      birth_year: 2000,
      age_years_at_registration: 26,
      phone: "9461234567",
      language: "hi",
    },
    {
      uhid: "UHID-2026-055",
      full_name: "Dinesh Bhati",
      sex: "M",
      birth_year: 1984,
      age_years_at_registration: 42,
      phone: "9828881122",
      language: "hi",
    },
  ];

  // Insert base demo patients
  const createdPatients: Record<string, string> = {};
  for (const p of demoPatients) {
    const { data } = await supabase
      .from("patients")
      .upsert(p, { onConflict: "uhid" })
      .select("id, uhid")
      .single();
    if (data?.uhid) {
      createdPatients[data.uhid] = data.id;
    }
  }

  // 7. Seed Visits (Token 87 Immediate, Token 23 Routine, etc.)
  console.log("7. Seeding demo visits...");
  const visits = [
    {
      patient_id: createdPatients["UHID-2026-087"],
      department_id: "GEN_MED",
      token_no: 87,
      level: "IMMEDIATE",
      status: "waiting",
      reason_en: "Chest pain with sweating (red-flag rule S01). High clinical risk.",
      reason_hi: "सीने में दर्द व पसीना (नियम S01)। तत्काल चिकित्सा आवश्यक।",
      fired_rules: ["S01"],
      tasks: ["Immediate 12-lead ECG", "Shift to Red Resuscitation Bay", "Alert Medical Officer"],
      symptom_tags: ["chest_pain", "sweating", "breathless_rest"],
      sort_key: 10,
    },
    {
      patient_id: createdPatients["UHID-2026-091"],
      department_id: "GEN_MED",
      token_no: 91,
      level: "IMMEDIATE",
      status: "with_nurse",
      reason_en: "Severe respiratory distress with SpO2 88% on room air",
      reason_hi: "गंभीर साँस फूलना व ऑक्सीजन 88%।",
      fired_rules: ["V02", "APLS_HYPOXIA"],
      tasks: ["High flow oxygen mask", "Nebulization stat", "Physician review"],
      symptom_tags: ["breathless", "blue_lips"],
      vitals: { rr: 32, spo2: 88, hr: 118, sbp: 154, dbp: 96, consciousness: "ALERT" },
      sort_key: 20,
    },
    {
      patient_id: createdPatients["UHID-2026-042"],
      department_id: "PAED",
      token_no: 42,
      level: "SOON",
      status: "waiting",
      reason_en: "High fever >39°C with persistent vomiting in toddler (APLS caution)",
      reason_hi: "तेज़ बुखार व लगातार उल्टी। प्राथमिकता जांच।",
      fired_rules: ["APLS_FEVER", "AGE_PEDIATRIC"],
      tasks: ["Paracetamol oral drops", "ORS sips", "Vitals monitoring"],
      symptom_tags: ["fever", "persistent_vomiting"],
      vitals: { temp_c: 39.2, hr: 138, consciousness: "ALERT" },
      sort_key: 100,
    },
    {
      patient_id: createdPatients["UHID-2026-015"],
      department_id: "GEN_MED",
      token_no: 15,
      level: "SOON",
      status: "waiting",
      reason_en: "Elderly patient (age ≥65) with infected foot ulcer & high glucose",
      reason_hi: "वरिष्ठ नागरिक (आयु 74) पाँव में घाव व शुगर की समस्या।",
      fired_rules: ["MOD_ELDERLY", "V_GLUCOSE_HIGH"],
      tasks: ["Capillary Blood Glucose check", "Foot wound dressing"],
      symptom_tags: ["wound", "diabetic_review"],
      vitals: { sbp: 142, dbp: 88, hr: 82, glucose_mgdl: 285, consciousness: "ALERT" },
      sort_key: 110,
    },
    {
      patient_id: createdPatients["UHID-2026-023"],
      department_id: "DERM",
      token_no: 23,
      level: "ROUTINE",
      status: "waiting",
      reason_en: "Mild localized rash without systemic signs. Standard OPD order.",
      reason_hi: "सामान्य त्वचा पर लालिमा/चकत्ते। नियमित क्रम।",
      fired_rules: ["R_DEFAULT"],
      tasks: ["Routine examination"],
      symptom_tags: ["skin_rash", "itching"],
      vitals: { rr: 16, spo2: 99, hr: 74, sbp: 118, dbp: 76, consciousness: "ALERT" },
      sort_key: 200,
    },
    {
      patient_id: createdPatients["UHID-2026-004"],
      department_id: "OBG",
      token_no: 4,
      level: "ROUTINE",
      status: "waiting",
      reason_en: "Antenatal routine 2nd trimester check-up. Normal baseline.",
      reason_hi: "गर्भावस्था नियमित जाँच। नियमित क्रम।",
      fired_rules: ["R_DEFAULT"],
      tasks: ["Fetal heart rate auscultation", "Weight & Urine dipstick"],
      symptom_tags: ["routine_checkup", "antenatal_review"],
      vitals: { sbp: 110, dbp: 70, hr: 78, consciousness: "ALERT" },
      sort_key: 210,
    },
  ];

  for (const v of visits) {
    if (!v.patient_id) continue;
    const { error: visitErr } = await supabase.from("visits").upsert(
      {
        ...v,
        visit_date: new Date().toISOString().slice(0, 10),
      },
      { onConflict: "department_id,visit_date,token_no" },
    );
    if (visitErr) console.error(`Error inserting visit ${v.token_no}:`, visitErr.message);
  }
  console.log("✓ Demo visits seeded (Token 87 Immediate, Token 23 Routine).");

  console.log("\n🎉 Database seed complete! All tables are populated and active.");
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
