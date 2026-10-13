"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CheckCircle,
  Clock,
  ShieldAlert,
  Siren,
  X,
} from "lucide-react";
import departmentsData from "../../../data/departments.json";
import { LevelBadge } from "@/components/level-badge";
import { queueStore, useQueueVisits, type PatientVisit } from "@/lib/queue-store";
import type { Level } from "@/engine/levels";
import { cn } from "@/lib/utils";

const OVERRIDE_REASONS = [
  { code: "CLIN_GUT", label: "Clinical judgement / Nurse intuition (मरीज़ की स्थिति गंभीर लग रही है)" },
  { code: "SEVERE_PAIN", label: "Severe distressing pain (असहनीय दर्द)" },
  { code: "RAPID_DETERIORATION", label: "Rapid deterioration while waiting (हालत बिगड़ रही है)" },
  { code: "DOC_DIRECT", label: "Doctor direct verbal instruction (डॉक्टर का निर्देश)" },
  { code: "PREGNANCY_DISTRESS", label: "Late pregnancy distress (गर्भावस्था जटिलता)" },
  { code: "FAMILY_PANIC", label: "Extreme agitation or panic (मरीज़/परिजन अत्यधिक व्यथित)" },
];

export default function NurseDashboardPage() {
  const visits = useQueueVisits();
  const [selectedDept, setSelectedDept] = useState("GEN_MED");

  // Vitals entry modal
  const [vitalsModalVisit, setVitalsModalVisit] = useState<PatientVisit | null>(null);
  const [rr, setRr] = useState<number | "">("");
  const [spo2, setSpo2] = useState<number | "">("");
  const [sbp, setSbp] = useState<number | "">("");
  const [dbp, setDbp] = useState<number | "">("");
  const [hr, setHr] = useState<number | "">("");
  const [tempC, setTempC] = useState<number | "">("");
  const [glucose, setGlucose] = useState<number | "">("");
  const [consciousness, setConsciousness] = useState<"ALERT" | "VOICE" | "PAIN" | "UNRESPONSIVE">("ALERT");

  // Override modal
  const [overrideModalVisit, setOverrideModalVisit] = useState<PatientVisit | null>(null);
  const [overrideLevel, setOverrideLevel] = useState<Level>("IMMEDIATE");
  const [overrideReasonCode, setOverrideReasonCode] = useState(OVERRIDE_REASONS[0]!.code);
  const [overrideNote, setOverrideNote] = useState("");

  // Department visits
  const deptVisits = useMemo(() => {
    return visits.filter(
      (v) =>
        v.departmentId === selectedDept &&
        ["waiting", "with_nurse", "called"].includes(v.status),
    );
  }, [visits, selectedDept]);

  // Lane buckets
  const immediateLanes = useMemo(
    () => deptVisits.filter((v) => v.level === "IMMEDIATE").sort((a, b) => a.sortKey - b.sortKey),
    [deptVisits],
  );
  const soonLanes = useMemo(
    () => deptVisits.filter((v) => v.level === "SOON").sort((a, b) => a.sortKey - b.sortKey),
    [deptVisits],
  );
  const routineLanes = useMemo(
    () => deptVisits.filter((v) => v.level === "ROUTINE").sort((a, b) => a.sortKey - b.sortKey),
    [deptVisits],
  );

  // Open vitals modal
  const handleOpenVitals = (visit: PatientVisit) => {
    setVitalsModalVisit(visit);
    setRr(visit.vitals?.rr ?? "");
    setSpo2(visit.vitals?.spo2 ?? "");
    setSbp(visit.vitals?.sbp ?? "");
    setDbp(visit.vitals?.dbp ?? "");
    setHr(visit.vitals?.hr ?? "");
    setTempC(visit.vitals?.temp_c ?? "");
    setGlucose(visit.vitals?.glucose_mgdl ?? "");
    setConsciousness(visit.vitals?.consciousness ?? "ALERT");
  };

  // Save vitals
  const handleSaveVitals = (e: React.FormEvent) => {
    e.preventDefault();
    if (!vitalsModalVisit) return;

    // Automatic check: SpO2 <= 92 or non-alert -> IMMEDIATE
    let autoLevel: Level = vitalsModalVisit.level;
    const tasks = [...vitalsModalVisit.tasks];

    if ((typeof spo2 === "number" && spo2 <= 92) || consciousness !== "ALERT") {
      autoLevel = "IMMEDIATE";
      if (!tasks.includes("Oxygen via NRB mask 10-15 L/min")) {
        tasks.push("Oxygen via NRB mask 10-15 L/min");
      }
    } else if (
      (typeof rr === "number" && (rr >= 24 || rr <= 9)) ||
      (typeof sbp === "number" && sbp >= 180) ||
      (typeof hr === "number" && (hr >= 120 || hr <= 45))
    ) {
      if (autoLevel === "ROUTINE") autoLevel = "SOON";
    }

    queueStore.updateVitals(
      vitalsModalVisit.id,
      {
        rr: typeof rr === "number" ? rr : undefined,
        spo2: typeof spo2 === "number" ? spo2 : undefined,
        sbp: typeof sbp === "number" ? sbp : undefined,
        dbp: typeof dbp === "number" ? dbp : undefined,
        hr: typeof hr === "number" ? hr : undefined,
        temp_c: typeof tempC === "number" ? tempC : undefined,
        glucose_mgdl: typeof glucose === "number" ? glucose : undefined,
        consciousness,
      },
      autoLevel,
      tasks,
    );

    setVitalsModalVisit(null);
  };

  // Open override modal
  const handleOpenOverride = (visit: PatientVisit) => {
    setOverrideModalVisit(visit);
    setOverrideLevel(visit.level === "IMMEDIATE" ? "SOON" : "IMMEDIATE");
    setOverrideReasonCode(OVERRIDE_REASONS[0]!.code);
    setOverrideNote("");
  };

  const handleSaveOverride = (e: React.FormEvent) => {
    e.preventDefault();
    if (!overrideModalVisit) return;
    queueStore.overrideLevel(overrideModalVisit.id, overrideLevel, overrideReasonCode, overrideNote);
    setOverrideModalVisit(null);
  };

  // Reorder
  const handleMove = (lane: PatientVisit[], index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= lane.length) return;
    const current = lane[index];
    const target = lane[targetIndex];
    if (!current || !target) return;
    queueStore.reorderWithinLane(selectedDept, current.level, current.id, target.id);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      {/* Top Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-hairline pb-4">
        <div>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-sandstone">
            <Activity className="size-3.5" /> Nurse Triage Station · नर्सिंग डेस्क
          </span>
          <h1 className="mt-1 font-serif text-2xl font-semibold text-ink sm:text-3xl">
            Live Priority Lanes & Triage Management
          </h1>
          <p className="text-sm text-muted">
            3-Tier deterministic queue · Clinical overrides require an auditable reason code
          </p>
        </div>

        {/* Department Switcher */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted">OPD Department:</span>
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

          <Link
            href="/reception"
            className="rounded-md border border-hairline bg-card px-3 py-2 text-xs font-medium text-ink hover:border-sandstone"
          >
            + Register New
          </Link>
          <Link
            href="/doctor"
            className="rounded-md bg-ink px-3 py-2 text-xs font-semibold text-paper hover:bg-ink/90"
          >
            Doctor View →
          </Link>
        </div>
      </div>

      {/* Overview Stats Bar */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-hairline bg-card p-4 shadow-xs">
          <div className="text-xs font-medium uppercase tracking-wider text-muted">Total Active Waiting</div>
          <div className="mt-1 text-2xl font-bold text-ink">{deptVisits.length}</div>
          <div className="mt-1 text-[11px] text-muted">In {selectedDept} queue today</div>
        </div>
        <div className="rounded-xl border border-brick/30 bg-brick/5 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-brick">Immediate</span>
            <AlertOctagon className="size-4 text-brick" />
          </div>
          <div className="mt-1 text-2xl font-bold text-brick">{immediateLanes.length}</div>
          <div className="mt-1 text-[11px] text-muted">S-1 High priority</div>
        </div>
        <div className="rounded-xl border border-turmeric/30 bg-turmeric/5 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-turmeric">Soon</span>
            <AlertTriangle className="size-4 text-turmeric" />
          </div>
          <div className="mt-1 text-2xl font-bold text-turmeric">{soonLanes.length}</div>
          <div className="mt-1 text-[11px] text-muted">Target &lt; 30 mins</div>
        </div>
        <div className="rounded-xl border border-neem/30 bg-neem/5 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-neem">Routine</span>
            <CheckCircle className="size-4 text-neem" />
          </div>
          <div className="mt-1 text-2xl font-bold text-neem">{routineLanes.length}</div>
          <div className="mt-1 text-[11px] text-muted">Standard FIFO queue</div>
        </div>
      </div>

      {/* 3 Priority Lanes Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Lane 1: IMMEDIATE */}
        <div className="flex flex-col rounded-xl border-2 border-brick/40 bg-brick/5 p-4 shadow-xs">
          <div className="flex items-center justify-between border-b border-brick/20 pb-3">
            <div className="flex items-center gap-2">
              <span className="size-3 rounded-xs bg-brick" />
              <h2 className="font-semibold uppercase tracking-wider text-brick">
                Lane 1 · IMMEDIATE ({immediateLanes.length})
              </h2>
            </div>
            <span className="rounded bg-brick px-2 py-0.5 text-[10px] font-bold text-paper uppercase">
              Target 0-5 min
            </span>
          </div>

          <div className="mt-4 flex-1 space-y-3">
            {immediateLanes.length === 0 ? (
              <div className="rounded-lg border border-dashed border-brick/30 p-6 text-center text-xs text-muted">
                No immediate red-flag patients currently in queue.
              </div>
            ) : (
              immediateLanes.map((v, idx) => (
                <PatientCard
                  key={v.id}
                  visit={v}
                  index={idx}
                  totalInLane={immediateLanes.length}
                  onOpenVitals={() => handleOpenVitals(v)}
                  onOpenOverride={() => handleOpenOverride(v)}
                  onMoveUp={() => handleMove(immediateLanes, idx, "up")}
                  onMoveDown={() => handleMove(immediateLanes, idx, "down")}
                  onCall={() => queueStore.callPatient(v.id, "Room 1")}
                  onSendCasualty={() => queueStore.transferEmergency(v.id)}
                />
              ))
            )}
          </div>
        </div>

        {/* Lane 2: SOON */}
        <div className="flex flex-col rounded-xl border border-turmeric/40 bg-turmeric/5 p-4 shadow-xs">
          <div className="flex items-center justify-between border-b border-turmeric/20 pb-3">
            <div className="flex items-center gap-2">
              <span className="size-3 rounded-xs bg-turmeric" />
              <h2 className="font-semibold uppercase tracking-wider text-turmeric">
                Lane 2 · SOON ({soonLanes.length})
              </h2>
            </div>
            <span className="rounded bg-turmeric px-2 py-0.5 text-[10px] font-bold text-paper uppercase">
              Target &lt; 30 min
            </span>
          </div>

          <div className="mt-4 flex-1 space-y-3">
            {soonLanes.length === 0 ? (
              <div className="rounded-lg border border-dashed border-turmeric/30 p-6 text-center text-xs text-muted">
                No priority patients in Soon lane.
              </div>
            ) : (
              soonLanes.map((v, idx) => (
                <PatientCard
                  key={v.id}
                  visit={v}
                  index={idx}
                  totalInLane={soonLanes.length}
                  onOpenVitals={() => handleOpenVitals(v)}
                  onOpenOverride={() => handleOpenOverride(v)}
                  onMoveUp={() => handleMove(soonLanes, idx, "up")}
                  onMoveDown={() => handleMove(soonLanes, idx, "down")}
                  onCall={() => queueStore.callPatient(v.id, "Room 2")}
                  onSendCasualty={() => queueStore.transferEmergency(v.id)}
                />
              ))
            )}
          </div>
        </div>

        {/* Lane 3: ROUTINE */}
        <div className="flex flex-col rounded-xl border border-hairline bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between border-b border-hairline pb-3">
            <div className="flex items-center gap-2">
              <span className="size-3 rounded-full bg-neem" />
              <h2 className="font-semibold uppercase tracking-wider text-ink">
                Lane 3 · ROUTINE ({routineLanes.length})
              </h2>
            </div>
            <span className="rounded bg-paper border border-hairline px-2 py-0.5 text-[10px] font-bold text-muted uppercase">
              Standard Queue
            </span>
          </div>

          <div className="mt-4 flex-1 space-y-3">
            {routineLanes.length === 0 ? (
              <div className="rounded-lg border border-dashed border-hairline p-6 text-center text-xs text-muted">
                No patients in Routine lane.
              </div>
            ) : (
              routineLanes.map((v, idx) => (
                <PatientCard
                  key={v.id}
                  visit={v}
                  index={idx}
                  totalInLane={routineLanes.length}
                  onOpenVitals={() => handleOpenVitals(v)}
                  onOpenOverride={() => handleOpenOverride(v)}
                  onMoveUp={() => handleMove(routineLanes, idx, "up")}
                  onMoveDown={() => handleMove(routineLanes, idx, "down")}
                  onCall={() => queueStore.callPatient(v.id, "Room 3")}
                  onSendCasualty={() => queueStore.transferEmergency(v.id)}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {/* Vitals Recording Modal */}
      {vitalsModalVisit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-xs">
          <form
            onSubmit={handleSaveVitals}
            className="w-full max-w-lg rounded-xl border border-hairline bg-card p-6 shadow-2xl animate-in fade-in-50 zoom-in-95"
          >
            <div className="flex items-center justify-between border-b border-hairline pb-3">
              <div>
                <h3 className="font-semibold text-ink">
                  Enter Vitals · {vitalsModalVisit.tokenLabel}
                </h3>
                <p className="text-xs text-muted">
                  {vitalsModalVisit.fullName} · {vitalsModalVisit.ageYears}y/{vitalsModalVisit.sex}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setVitalsModalVisit(null)}
                className="rounded-md p-1 text-muted hover:text-ink"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
              <div>
                <label className="block text-xs font-medium text-ink">
                  SpO2 (%) <span className="text-brick">≤92 → Imm</span>
                </label>
                <input
                  type="number"
                  min={50}
                  max={100}
                  placeholder="e.g. 98"
                  value={spo2}
                  onChange={(e) => setSpo2(e.target.value === "" ? "" : Number(e.target.value))}
                  className="mt-1 w-full rounded-md border border-hairline bg-paper px-3 py-1.5 text-xs text-ink focus:border-sandstone focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-ink">Resp Rate (/min)</label>
                <input
                  type="number"
                  min={5}
                  max={60}
                  placeholder="e.g. 18"
                  value={rr}
                  onChange={(e) => setRr(e.target.value === "" ? "" : Number(e.target.value))}
                  className="mt-1 w-full rounded-md border border-hairline bg-paper px-3 py-1.5 text-xs text-ink focus:border-sandstone focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-ink">Pulse / HR (bpm)</label>
                <input
                  type="number"
                  min={30}
                  max={240}
                  placeholder="e.g. 78"
                  value={hr}
                  onChange={(e) => setHr(e.target.value === "" ? "" : Number(e.target.value))}
                  className="mt-1 w-full rounded-md border border-hairline bg-paper px-3 py-1.5 text-xs text-ink focus:border-sandstone focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-ink">Systolic BP (mmHg)</label>
                <input
                  type="number"
                  min={50}
                  max={260}
                  placeholder="e.g. 120"
                  value={sbp}
                  onChange={(e) => setSbp(e.target.value === "" ? "" : Number(e.target.value))}
                  className="mt-1 w-full rounded-md border border-hairline bg-paper px-3 py-1.5 text-xs text-ink focus:border-sandstone focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-ink">Diastolic BP (mmHg)</label>
                <input
                  type="number"
                  min={30}
                  max={160}
                  placeholder="e.g. 80"
                  value={dbp}
                  onChange={(e) => setDbp(e.target.value === "" ? "" : Number(e.target.value))}
                  className="mt-1 w-full rounded-md border border-hairline bg-paper px-3 py-1.5 text-xs text-ink focus:border-sandstone focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-ink">Temp (°C)</label>
                <input
                  type="number"
                  step="0.1"
                  min={30}
                  max={45}
                  placeholder="e.g. 37.0"
                  value={tempC}
                  onChange={(e) => setTempC(e.target.value === "" ? "" : Number(e.target.value))}
                  className="mt-1 w-full rounded-md border border-hairline bg-paper px-3 py-1.5 text-xs text-ink focus:border-sandstone focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-ink">Blood Glucose (mg/dL)</label>
                <input
                  type="number"
                  min={20}
                  max={700}
                  placeholder="e.g. 110"
                  value={glucose}
                  onChange={(e) => setGlucose(e.target.value === "" ? "" : Number(e.target.value))}
                  className="mt-1 w-full rounded-md border border-hairline bg-paper px-3 py-1.5 text-xs text-ink focus:border-sandstone focus:outline-hidden"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-ink">Consciousness (AVPU)</label>
                <select
                  value={consciousness}
                  onChange={(e) =>
                    setConsciousness(
                      e.target.value as "ALERT" | "VOICE" | "PAIN" | "UNRESPONSIVE",
                    )
                  }
                  className="mt-1 w-full rounded-md border border-hairline bg-paper px-3 py-1.5 text-xs text-ink focus:border-sandstone focus:outline-hidden"
                >
                  <option value="ALERT">Alert (A - पूर्ण सचेत)</option>
                  <option value="VOICE">Responds to Voice (V - आवाज़ पर)</option>
                  <option value="PAIN">Responds to Pain (P - दर्द पर)</option>
                  <option value="UNRESPONSIVE">Unresponsive (U - अचेत)</option>
                </select>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2 border-t border-hairline pt-4">
              <button
                type="button"
                onClick={() => setVitalsModalVisit(null)}
                className="rounded-lg border border-hairline px-4 py-2 text-xs font-medium text-ink hover:bg-paper"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-lg bg-ink px-4 py-2 text-xs font-semibold text-paper hover:bg-ink/90"
              >
                Save & Recalculate Triage
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Override Reason Modal */}
      {overrideModalVisit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-xs">
          <form
            onSubmit={handleSaveOverride}
            className="w-full max-w-md rounded-xl border border-hairline bg-card p-6 shadow-2xl animate-in fade-in-50 zoom-in-95"
          >
            <div className="flex items-center justify-between border-b border-hairline pb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="size-5 text-turmeric" />
                <h3 className="font-semibold text-ink">
                  Clinical Override · {overrideModalVisit.tokenLabel}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setOverrideModalVisit(null)}
                className="rounded-md p-1 text-muted hover:text-ink"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-ink">New Target Priority</label>
                <div className="mt-1.5 flex gap-2">
                  {(["IMMEDIATE", "SOON", "ROUTINE"] as const).map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setOverrideLevel(lvl)}
                      className={cn(
                        "flex-1 rounded-lg border py-2 text-xs font-semibold uppercase transition-colors",
                        overrideLevel === lvl
                          ? "border-sandstone bg-sandstone/15 text-ink"
                          : "border-hairline bg-paper text-muted hover:text-ink",
                      )}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-ink">
                  Justification Reason Code <span className="text-brick">*</span>
                </label>
                <select
                  value={overrideReasonCode}
                  onChange={(e) => setOverrideReasonCode(e.target.value)}
                  className="mt-1 w-full rounded-md border border-hairline bg-paper p-2 text-xs text-ink focus:border-sandstone focus:outline-hidden"
                >
                  {OVERRIDE_REASONS.map((r) => (
                    <option key={r.code} value={r.code}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-ink">Clinical Note / टिप्पणी</label>
                <textarea
                  rows={2}
                  placeholder="Specific observations or doctor request..."
                  value={overrideNote}
                  onChange={(e) => setOverrideNote(e.target.value)}
                  className="mt-1 w-full rounded-md border border-hairline bg-paper p-2 text-xs text-ink focus:border-sandstone focus:outline-hidden"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2 border-t border-hairline pt-4">
              <button
                type="button"
                onClick={() => setOverrideModalVisit(null)}
                className="rounded-lg border border-hairline px-4 py-2 text-xs font-medium text-ink hover:bg-paper"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-lg bg-ink px-4 py-2 text-xs font-semibold text-paper hover:bg-ink/90"
              >
                Confirm Override (Log to Audit)
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function PatientCard({
  visit,
  index,
  totalInLane,
  onOpenVitals,
  onOpenOverride,
  onMoveUp,
  onMoveDown,
  onCall,
  onSendCasualty,
}: {
  visit: PatientVisit;
  index: number;
  totalInLane: number;
  onOpenVitals: () => void;
  onOpenOverride: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onCall: () => void;
  onSendCasualty: () => void;
}) {
  const waitedMin = Math.round((Date.now() - new Date(visit.registeredAt).getTime()) / 60000);

  return (
    <div
      className={cn(
        "rounded-xl border bg-card p-4 shadow-xs transition-all",
        visit.level === "IMMEDIATE" ? "border-brick/40" : "border-hairline",
        visit.status === "called" && "ring-2 ring-turmeric",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-base font-bold text-ink">{visit.tokenLabel}</span>
            <span className="text-xs text-muted">
              {visit.ageYears}y · {visit.sex}
            </span>
            {visit.status === "called" && (
              <span className="rounded bg-turmeric/20 px-1.5 py-0.5 text-[10px] font-bold text-turmeric uppercase">
                Called {visit.roomLabel}
              </span>
            )}
          </div>
          <h3 className="mt-0.5 text-xs font-semibold text-ink">{visit.fullName}</h3>
        </div>

        {/* Up / Down Reorder Arrows */}
        <div className="flex items-center gap-0.5 rounded border border-hairline bg-paper p-0.5">
          <button
            type="button"
            disabled={index === 0}
            onClick={onMoveUp}
            className="rounded p-1 text-muted hover:text-ink disabled:opacity-20"
            title="Move higher in lane"
          >
            <ArrowUp className="size-3" />
          </button>
          <button
            type="button"
            disabled={index === totalInLane - 1}
            onClick={onMoveDown}
            className="rounded p-1 text-muted hover:text-ink disabled:opacity-20"
            title="Move lower in lane"
          >
            <ArrowDown className="size-3" />
          </button>
        </div>
      </div>

      {/* Clinical Reason */}
      <div className="mt-2.5 rounded-md border border-hairline bg-paper p-2 text-xs">
        <div className="font-medium text-ink">{visit.reasonEn}</div>
        <div className="mt-0.5 font-deva text-[11px] text-muted">{visit.reasonHi}</div>
      </div>

      {/* Vitals summary if present */}
      {visit.vitals && Object.keys(visit.vitals).length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-mono text-muted">
          {visit.vitals.spo2 && (
            <span className={cn("rounded px-1.5 py-0.5", visit.vitals.spo2 <= 92 ? "bg-brick text-paper" : "bg-paper")}>
              SpO2: {visit.vitals.spo2}%
            </span>
          )}
          {visit.vitals.rr && <span className="bg-paper px-1.5 py-0.5 rounded">RR: {visit.vitals.rr}</span>}
          {visit.vitals.sbp && <span className="bg-paper px-1.5 py-0.5 rounded">BP: {visit.vitals.sbp}/{visit.vitals.dbp}</span>}
          {visit.vitals.hr && <span className="bg-paper px-1.5 py-0.5 rounded">HR: {visit.vitals.hr}</span>}
          {visit.vitals.glucose_mgdl && <span className="bg-paper px-1.5 py-0.5 rounded">Glu: {visit.vitals.glucose_mgdl}</span>}
        </div>
      )}

      {/* Clinical Tasks required */}
      {visit.tasks && visit.tasks.length > 0 && (
        <div className="mt-2 space-y-1">
          {visit.tasks.map((task, i) => (
            <div key={i} className="flex items-center gap-1.5 text-[11px] text-turmeric font-medium">
              <CheckCircle className="size-3 shrink-0" />
              <span>{task}</span>
            </div>
          ))}
        </div>
      )}

      {/* Footer Info & Actions */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-hairline pt-2 text-xs">
        <span className="flex items-center gap-1 text-[11px] text-muted">
          <Clock className="size-3" /> {waitedMin}m wait
        </span>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onOpenVitals}
            className="rounded border border-hairline bg-paper px-2 py-1 text-[11px] font-medium text-ink hover:border-sandstone transition-colors"
          >
            Vitals
          </button>
          <button
            type="button"
            onClick={onOpenOverride}
            className="rounded border border-hairline bg-paper px-2 py-1 text-[11px] font-medium text-ink hover:border-sandstone transition-colors"
          >
            Override
          </button>
          <button
            type="button"
            onClick={onCall}
            className="rounded bg-ink px-2.5 py-1 text-[11px] font-semibold text-paper hover:bg-ink/90 transition-colors"
          >
            Call
          </button>
          {visit.level === "IMMEDIATE" && (
            <button
              type="button"
              onClick={onSendCasualty}
              title="Send to Casualty / Emergency"
              className="rounded bg-brick p-1 text-paper hover:bg-brick/90"
            >
              <Siren className="size-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
