import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { evaluatePatientTriage } from "@/engine/client-eval";
import type { PatientVisit } from "@/lib/queue-store";

function mapRowToVisit(row: any): PatientVisit {
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

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = createAdminClient();
    const body = await req.json();
    const { vitals } = body;

    const { data: existing, error: fetchErr } = await supabase
      .from("visits")
      .select("*, patient:patients(*)")
      .eq("id", id)
      .single();

    if (fetchErr || !existing) {
      return NextResponse.json({ error: "Visit not found" }, { status: 404 });
    }

    const mergedVitals = { ...(existing.vitals || {}), ...(vitals || {}) };

    // Deterministic re-evaluation
    const triage = evaluatePatientTriage({
      age_years: existing.patient?.age_years_at_registration || 30,
      sex: existing.patient?.sex === "F" ? "F" : existing.patient?.sex === "M" ? "M" : "O",
      pregnant: Boolean(existing.patient?.pregnant),
      conditions: [],
      tags: existing.symptom_tags || [],
      free_text: existing.free_text || undefined,
      vitals: mergedVitals,
    });

    const isEscalation =
      existing.level === "ROUTINE" && (triage.level === "SOON" || triage.level === "IMMEDIATE");

    const newSortKey =
      triage.level === "IMMEDIATE" ? 10 : triage.level === "SOON" ? 100 : 200;

    const { data: updated, error: updateErr } = await supabase
      .from("visits")
      .update({
        vitals: mergedVitals,
        vitals_taken_at: new Date().toISOString(),
        level: triage.level,
        reason_en: triage.reason_en,
        reason_hi: triage.reason_hi,
        tasks: triage.tasks,
        sort_key: newSortKey,
        triaged_at: new Date().toISOString(),
        status: existing.status === "registered" ? "waiting" : existing.status,
      })
      .eq("id", id)
      .select("*, patient:patients(*), room:rooms(*)")
      .single();

    if (updateErr || !updated) {
      return NextResponse.json({ error: updateErr?.message || "Failed to update" }, { status: 500 });
    }

    // Log vitals audit event
    await supabase.from("triage_events").insert({
      visit_id: id,
      type: isEscalation ? "escalated" : "vitals_added",
      from_level: existing.level,
      to_level: triage.level,
      note: triage.reason_en,
      fired_rules: triage.fired_rules,
      payload: { vitals: mergedVitals, fired_rules: triage.fired_rules },
    });

    return NextResponse.json(mapRowToVisit(updated));
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}
