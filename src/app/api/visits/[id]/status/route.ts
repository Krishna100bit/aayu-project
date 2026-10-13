import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
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

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = createAdminClient();
    const body = await req.json();
    const { status, roomLabel, departmentId } = body;

    const updates: Record<string, any> = { status };
    const now = new Date().toISOString();

    if (status === "called") {
      updates.called_at = now;
      if (roomLabel) {
        // match room by number if present
        const roomNum = roomLabel.replace(/[^0-9]/g, "");
        if (roomNum) {
          const { data: rm } = await supabase
            .from("rooms")
            .select("id")
            .eq("room_number", roomNum)
            .limit(1)
            .single();
          if (rm) updates.room_id = rm.id;
        }
      }
    } else if (status === "in_consult") {
      updates.consult_start = now;
    } else if (status === "done") {
      updates.consult_end = now;
    } else if (status === "sent_emergency") {
      updates.level = "IMMEDIATE";
      updates.department_id = "EMERG";
    }

    if (departmentId) {
      updates.department_id = departmentId;
    }

    const { data: updated, error: updateErr } = await supabase
      .from("visits")
      .update(updates)
      .eq("id", id)
      .select("*, patient:patients(*), room:rooms(*)")
      .single();

    if (updateErr || !updated) {
      return NextResponse.json({ error: updateErr?.message || "Failed to update status" }, { status: 500 });
    }

    // Append audit event
    const eventType =
      status === "called"
        ? "called"
        : status === "sent_emergency"
          ? "sent_emergency"
          : status === "skipped"
            ? "skipped"
            : "seen";

    await supabase.from("triage_events").insert({
      visit_id: id,
      type: eventType,
      payload: { status, roomLabel, updates },
    });

    return NextResponse.json(mapRowToVisit(updated));
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}
