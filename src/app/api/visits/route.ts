import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { evaluatePatientTriage } from "@/engine/client-eval";
import type { PatientVisit } from "@/lib/queue-store";

interface DatabaseVisitRow {
  id: string;
  department_id: string;
  token_no: number;
  token_label?: string;
  status_code: string;
  visit_date: string;
  registered_at: string;
  triaged_at?: string;
  called_at?: string;
  consult_start?: string;
  consult_end?: string;
  status: PatientVisit["status"];
  level: PatientVisit["level"];
  level_source: PatientVisit["levelSource"];
  reason_en?: string;
  reason_hi?: string;
  fired_rules?: string[];
  tasks?: string[];
  needs_verification?: boolean;
  symptom_tags?: string[];
  free_text?: string;
  vitals?: PatientVisit["vitals"];
  sort_key?: number;
  patient?: {
    uhid?: string;
    full_name?: string;
    age_years_at_registration?: number;
    sex?: string;
    phone?: string;
    pregnant?: boolean;
  };
  room?: {
    room_number?: string;
  };
}

function mapRowToVisit(row: DatabaseVisitRow): PatientVisit {
  return {
    id: row.id,
    uhid: row.patient?.uhid || undefined,
    fullName: row.patient?.full_name || "Unknown Patient",
    ageYears: row.patient?.age_years_at_registration || 0,
    sex: (row.patient?.sex as "M" | "F" | "O") || "O",
    phone: row.patient?.phone || undefined,
    pregnant: Boolean(row.patient?.pregnant),
    departmentId: row.department_id,
    tokenNo: row.token_no,
    tokenLabel: row.token_label || `${row.department_id}-${String(row.token_no).padStart(3, "0")}`,
    statusCode: row.status_code,
    visitDate: row.visit_date,
    registeredAt: row.registered_at,
    triagedAt: row.triaged_at || undefined,
    calledAt: row.called_at || undefined,
    consultStart: row.consult_start || undefined,
    consultEnd: row.consult_end || undefined,
    status: row.status,
    roomLabel: row.room?.room_number ? `Room ${row.room.room_number}` : undefined,
    level: row.level,
    levelSource: row.level_source,
    reasonEn: row.reason_en || "",
    reasonHi: row.reason_hi || "",
    firedRules: row.fired_rules || [],
    tasks: row.tasks || [],
    needsVerification: Boolean(row.needs_verification),
    symptomTags: row.symptom_tags || [],
    freeText: row.free_text || undefined,
    vitals: row.vitals || undefined,
    sortKey: Number(row.sort_key) || 100,
  };
}

export async function GET(req: NextRequest) {
  try {
    const supabase = createAdminClient();
    const { searchParams } = new URL(req.url);
    const department = searchParams.get("department");

    let query = supabase
      .from("visits")
      .select("*, patient:patients(*), room:rooms(*)")
      .order("sort_key", { ascending: true });

    if (department && department !== "ALL") {
      query = query.eq("department_id", department);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const visits = ((data || []) as unknown as DatabaseVisitRow[]).map(mapRowToVisit);
    return NextResponse.json(visits);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createAdminClient();
    const body = await req.json();

    const {
      fullName,
      ageYears,
      sex,
      phone,
      pregnant,
      departmentId,
      symptomTags = [],
      freeText,
      vitals,
      visitType = "new",
    } = body;

    if (!fullName || !departmentId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // 1. Authoritative deterministic triage evaluation on the server
    const triageResult = evaluatePatientTriage({
      age_years: Number(ageYears) || 30,
      sex: sex === "F" ? "F" : sex === "M" ? "M" : "O",
      pregnant: Boolean(pregnant),
      conditions: body.conditions || [],
      tags: symptomTags,
      free_text: freeText || undefined,
      vitals: vitals || {},
    });

    // 2. Insert or find patient
    const uhid = `UHID-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const birthYear = new Date().getFullYear() - (Number(ageYears) || 30);

    const patientConditions = body.conditions || [];
    if (pregnant && !patientConditions.includes("pregnant")) {
      patientConditions.push("pregnant");
    }

    const { data: patient, error: patientError } = await supabase
      .from("patients")
      .insert({
        uhid,
        full_name: fullName,
        sex,
        birth_year: birthYear,
        age_years_at_registration: Number(ageYears) || 30,
        phone: phone || null,
        conditions: patientConditions,
      })
      .select()
      .single();

    if (patientError || !patient) {
      return NextResponse.json({ error: patientError?.message || "Failed to create patient" }, { status: 500 });
    }

    // 3. Obtain consecutive token number from Supabase
    let tokenNo = 1;
    const { data: tokenData, error: tokenError } = await supabase.rpc("next_token", { dept: departmentId });
    if (!tokenError && typeof tokenData === "number") {
      tokenNo = tokenData;
    } else {
      // Fallback if RPC fails: compute max token for today
      const today = new Date().toISOString().slice(0, 10);
      const { data: maxRows } = await supabase
        .from("visits")
        .select("token_no")
        .eq("department_id", departmentId)
        .eq("visit_date", today)
        .order("token_no", { ascending: false })
        .limit(1);
      const row = maxRows?.[0] as { token_no: number } | undefined;
      tokenNo = (row?.token_no || 0) + 1;
    }

    // 4. Determine initial sort key based on level
    const baseSort = triageResult.level === "IMMEDIATE" ? 10 : triageResult.level === "SOON" ? 100 : 200;
    const sortKey = baseSort + Math.random() * 2;
    const statusCode = Math.random().toString(36).substring(2, 10);

    // 5. Insert visit
    const { data: visit, error: visitError } = await supabase
      .from("visits")
      .insert({
        patient_id: patient.id,
        department_id: departmentId,
        token_no: tokenNo,
        visit_date: new Date().toISOString().slice(0, 10),
        status_code: statusCode,
        visit_type: visitType,
        symptom_tags: symptomTags,
        free_text: freeText || null,
        vitals: vitals || {},
        level: triageResult.level,
        level_source: "system",
        reason_en: triageResult.reason_en,
        reason_hi: triageResult.reason_hi,
        fired_rules: triageResult.fired_rules,
        rule_version: triageResult.rule_version,
        tasks: triageResult.tasks,
        needs_verification: triageResult.needs_verification,
        sort_key: sortKey,
        status: "waiting",
      })
      .select("*, patient:patients(*), room:rooms(*)")
      .single();

    if (visitError || !visit) {
      return NextResponse.json({ error: visitError?.message || "Failed to create visit" }, { status: 500 });
    }

    // 6. Append audit events
    await supabase.from("triage_events").insert([
      {
        visit_id: visit.id,
        type: "registered",
        payload: { token: visit.token_label, department: departmentId },
      },
      {
        visit_id: visit.id,
        type: "suggested",
        to_level: triageResult.level,
        note: triageResult.reason_en,
        fired_rules: triageResult.fired_rules,
        rule_version: triageResult.rule_version,
        payload: { fired_rules: triageResult.fired_rules, rule_version: triageResult.rule_version },
      },
    ]);

    return NextResponse.json(mapRowToVisit(visit as unknown as DatabaseVisitRow), { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
