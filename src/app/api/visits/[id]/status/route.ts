import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
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

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = createAdminClient();
    const body = await req.json();
    const { status, roomLabel, departmentId } = body;

    const updates: Record<string, unknown> = { status };
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

    return NextResponse.json(mapRowToVisit(updated as unknown as DatabaseVisitRow));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
