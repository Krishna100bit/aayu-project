"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import {
  Clock,
  Stethoscope,
  Users,
} from "lucide-react";
import departmentsData from "../../../data/departments.json";
import { LevelBadge } from "@/components/level-badge";
import { queueStore, useQueueVisits, type PatientVisit } from "@/lib/queue-store";
import { cn } from "@/lib/utils";

export default function DoctorDashboardPage() {
  const visits = useQueueVisits();
  const [selectedDept, setSelectedDept] = useState("GEN_MED");
  const [activeRoom, setActiveRoom] = useState("Room 1");
  const [consultSeconds, setConsultSeconds] = useState(0);

  // Active patient in consult or called for this room
  const activePatient = useMemo(() => {
    return visits.find(
      (v) =>
        v.departmentId === selectedDept &&
        (v.status === "in_consult" || (v.status === "called" && v.roomLabel === activeRoom)),
    );
  }, [visits, selectedDept, activeRoom]);

  // Next waiting patients for this department
  const waitingPatients = useMemo(() => {
    return visits
      .filter((v) => v.departmentId === selectedDept && v.status === "waiting")
      .sort((a, b) => {
        const rankMap = { IMMEDIATE: 1, SOON: 2, ROUTINE: 3 };
        const diff = rankMap[a.level] - rankMap[b.level];
        if (diff !== 0) return diff;
        return a.sortKey - b.sortKey;
      });
  }, [visits, selectedDept]);

  // Consultation elapsed timer
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (activePatient && activePatient.status === "in_consult") {
      timer = setInterval(() => {
        setConsultSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      setConsultSeconds(0);
    }
    return () => clearInterval(timer);
  }, [activePatient]);

  const formatTimer = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(mins).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const handleCallNext = (visit: PatientVisit) => {
    queueStore.callPatient(visit.id, activeRoom);
  };

  const handleStartConsult = () => {
    if (activePatient) {
      queueStore.startConsult(activePatient.id);
    }
  };

  const handleFinishConsult = () => {
    if (activePatient) {
      queueStore.finishConsult(activePatient.id);
      setConsultSeconds(0);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-hairline pb-4">
        <div>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-sandstone">
            <Stethoscope className="size-3.5" /> Doctor OPD Console · चिकित्सक कक्ष
          </span>
          <h1 className="mt-1 font-serif text-2xl font-semibold text-ink sm:text-3xl">
            Active Consultations & Queue
          </h1>
          <p className="text-sm text-muted">
            Decision support snapshot · Patients ordered strictly by clinical urgency
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted">Dept:</span>
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="rounded-lg border border-hairline bg-card px-3 py-2 text-xs font-semibold text-ink shadow-xs focus:border-sandstone focus:outline-hidden"
            >
              {departmentsData.departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name_en} ({d.id})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted">Room:</span>
            <select
              value={activeRoom}
              onChange={(e) => setActiveRoom(e.target.value)}
              className="rounded-lg border border-hairline bg-card px-3 py-2 text-xs font-semibold text-ink shadow-xs focus:border-sandstone focus:outline-hidden"
            >
              <option value="Room 1">Room 1</option>
              <option value="Room 2">Room 2</option>
              <option value="Room 3">Room 3</option>
            </select>
          </div>

          <Link
            href="/display/GEN_MED"
            target="_blank"
            className="rounded-md border border-hairline bg-card px-3 py-2 text-xs font-medium text-ink hover:border-sandstone"
          >
            TV Display ↗
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Left: Active Consultation Bay (7 cols) */}
        <div className="space-y-6 lg:col-span-7">
          <div className="rounded-xl border border-hairline bg-card p-6 shadow-xs">
            <div className="flex items-center justify-between border-b border-hairline pb-4">
              <div className="flex items-center gap-2">
                <span className="size-2.5 rounded-full bg-sandstone animate-pulse" />
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
                  Current Patient in {activeRoom}
                </h2>
              </div>
              {activePatient?.status === "in_consult" && (
                <span className="font-mono text-xs font-bold text-turmeric flex items-center gap-1.5">
                  <Clock className="size-3.5" /> Consult: {formatTimer(consultSeconds)}
                </span>
              )}
            </div>

            {activePatient ? (
              <div className="mt-5 space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <span className="font-mono text-3xl font-extrabold text-ink">
                      {activePatient.tokenLabel}
                    </span>
                    <h3 className="mt-1 text-lg font-bold text-ink">{activePatient.fullName}</h3>
                    <p className="text-xs text-muted">
                      Age: {activePatient.ageYears}y · Sex: {activePatient.sex} · Phone:{" "}
                      {activePatient.phone || "Not recorded"}
                    </p>
                  </div>
                  <LevelBadge level={activePatient.level} size="lg" bilingual />
                </div>

                {/* Clinical Reason & Fired Rules */}
                <div className="rounded-lg border border-hairline bg-paper p-4 text-xs">
                  <span className="font-semibold uppercase tracking-wider text-muted">
                    Triage Reason & Clinical Rules:
                  </span>
                  <div className="mt-1 font-medium text-ink">{activePatient.reasonEn}</div>
                  <div className="mt-0.5 font-deva text-muted">{activePatient.reasonHi}</div>
                  {activePatient.overrideReason && (
                    <div className="mt-2 text-xs font-semibold text-turmeric">
                      ⚠️ Nurse Override: {activePatient.overrideReason}
                    </div>
                  )}
                </div>

                {/* Vitals Snapshot */}
                <div className="rounded-lg border border-hairline bg-paper p-4 text-xs">
                  <span className="font-semibold uppercase tracking-wider text-muted">
                    Vital Signs Snapshot:
                  </span>
                  {activePatient.vitals && Object.keys(activePatient.vitals).length > 0 ? (
                    <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4 font-mono">
                      <div>
                        <span className="text-muted text-[10px]">SpO2</span>
                        <div className={cn("font-bold text-sm", activePatient.vitals.spo2 && activePatient.vitals.spo2 <= 92 ? "text-brick" : "text-ink")}>
                          {activePatient.vitals.spo2 ? `${activePatient.vitals.spo2}%` : "—"}
                        </div>
                      </div>
                      <div>
                        <span className="text-muted text-[10px]">Blood Pressure</span>
                        <div className="font-bold text-sm text-ink">
                          {activePatient.vitals.sbp ? `${activePatient.vitals.sbp}/${activePatient.vitals.dbp}` : "—"}
                        </div>
                      </div>
                      <div>
                        <span className="text-muted text-[10px]">Pulse Rate</span>
                        <div className="font-bold text-sm text-ink">
                          {activePatient.vitals.hr ? `${activePatient.vitals.hr} bpm` : "—"}
                        </div>
                      </div>
                      <div>
                        <span className="text-muted text-[10px]">Resp Rate</span>
                        <div className="font-bold text-sm text-ink">
                          {activePatient.vitals.rr ? `${activePatient.vitals.rr} /m` : "—"}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-1 text-muted italic">Vitals not recorded yet (Routine intake).</div>
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex flex-wrap items-center gap-3 border-t border-hairline pt-4">
                  {activePatient.status === "called" && (
                    <button
                      type="button"
                      onClick={handleStartConsult}
                      className="flex-1 rounded-lg bg-ink py-2.5 text-xs font-semibold text-paper hover:bg-ink/90 transition-colors"
                    >
                      Start Consultation (मरीज़ कक्ष में आया)
                    </button>
                  )}
                  {activePatient.status === "in_consult" && (
                    <button
                      type="button"
                      onClick={handleFinishConsult}
                      className="flex-1 rounded-lg bg-neem py-2.5 text-xs font-semibold text-paper hover:bg-neem/90 transition-colors"
                    >
                      Complete & Discharge (परामर्श पूर्ण)
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => queueStore.transferEmergency(activePatient.id)}
                    className="rounded-lg border border-brick bg-brick/10 px-4 py-2.5 text-xs font-semibold text-brick hover:bg-brick/20 transition-colors"
                  >
                    Transfer to Casualty
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-8 flex flex-col items-center justify-center p-8 text-center text-muted">
                <Users className="size-12 stroke-[1.25] text-muted/60" />
                <h3 className="mt-3 text-sm font-semibold text-ink">No Patient in Room</h3>
                <p className="mt-1 text-xs">
                  Call the next waiting patient from the queue on the right.
                </p>
                {waitingPatients.length > 0 && waitingPatients[0] && (
                  <button
                    type="button"
                    onClick={() => handleCallNext(waitingPatients[0]!)}
                    className="mt-4 rounded-lg bg-ink px-4 py-2 text-xs font-semibold text-paper hover:bg-ink/90"
                  >
                    Call Next ({waitingPatients[0].tokenLabel})
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right: Next in Queue (5 cols) */}
        <div className="space-y-6 lg:col-span-5">
          <div className="rounded-xl border border-hairline bg-card p-5 shadow-xs">
            <div className="flex items-center justify-between border-b border-hairline pb-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">
                Waiting for {selectedDept} ({waitingPatients.length})
              </h3>
              <span className="text-[11px] font-mono text-muted">Priority Order</span>
            </div>

            <div className="mt-4 space-y-3">
              {waitingPatients.length === 0 ? (
                <div className="rounded-lg border border-dashed border-hairline p-6 text-center text-xs text-muted">
                  Queue is clear! No patients waiting.
                </div>
              ) : (
                waitingPatients.map((v) => (
                  <div
                    key={v.id}
                    className={cn(
                      "flex items-center justify-between rounded-lg border p-3 transition-colors",
                      v.level === "IMMEDIATE"
                        ? "border-brick/40 bg-brick/5"
                        : "border-hairline bg-paper",
                    )}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold text-ink">
                          {v.tokenLabel}
                        </span>
                        <LevelBadge level={v.level} size="sm" />
                      </div>
                      <div className="text-xs font-medium text-ink">{v.fullName}</div>
                      <div className="text-[11px] text-muted line-clamp-1">{v.reasonEn}</div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleCallNext(v)}
                      className="ml-3 shrink-0 rounded-md bg-ink px-3 py-1.5 text-xs font-semibold text-paper hover:bg-ink/90 transition-colors"
                    >
                      Call
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
