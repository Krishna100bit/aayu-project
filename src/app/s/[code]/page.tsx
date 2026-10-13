"use client";

import { use, useMemo } from "react";
import Link from "next/link";
import {
  AlertOctagon,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { useQueueVisits } from "@/lib/queue-store";
import { LevelBadge } from "@/components/level-badge";

export default function PatientStatusPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const resolvedParams = use(params);
  const code = resolvedParams.code;
  const visits = useQueueVisits();

  // Find this patient by statusCode or fallback to first matching token
  const patient = useMemo(() => {
    return visits.find((v) => v.statusCode.toLowerCase() === code.toLowerCase()) || visits[0];
  }, [visits, code]);

  // Calculate position in department queue
  const queueInfo = useMemo(() => {
    if (!patient) return { position: 1, aheadCount: 0 };
    const deptWaiting = visits
      .filter((v) => v.departmentId === patient.departmentId && v.status === "waiting")
      .sort((a, b) => {
        const rankMap = { IMMEDIATE: 1, SOON: 2, ROUTINE: 3 };
        const diff = rankMap[a.level] - rankMap[b.level];
        if (diff !== 0) return diff;
        return a.sortKey - b.sortKey;
      });

    const idx = deptWaiting.findIndex((v) => v.id === patient.id);
    const position = idx >= 0 ? idx + 1 : 1;
    return { position, aheadCount: Math.max(0, position - 1) };
  }, [visits, patient]);

  if (!patient) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-xl font-bold text-ink">Token Not Found</h1>
        <p className="mt-2 text-sm text-muted">Please check your slip or scan the QR code again.</p>
        <Link href="/" className="mt-4 inline-block text-xs font-semibold text-sandstone">
          Back to Home
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-6 sm:px-6">
      {/* Top hospital branding */}
      <div className="text-center">
        <span className="rounded-full border border-hairline bg-card px-3 py-1 font-mono text-[11px] font-semibold text-muted uppercase">
          Live Patient Token Status · लाइव टोकन स्थिति
        </span>
        <h1 className="mt-3 font-serif text-2xl font-bold text-ink">
          District Hospital Jodhpur
        </h1>
        <p className="text-xs text-muted">Department: {patient.departmentId} · ओ.पी.डी.</p>
      </div>

      {/* Main Status Ticket */}
      <div className="mt-6 rounded-2xl border-2 border-hairline bg-card p-6 shadow-sm text-center">
        <div className="text-xs font-medium uppercase tracking-wider text-muted">
          Your Token Number / आपका टोकन
        </div>
        <div className="mt-2 font-mono text-5xl font-black tracking-tight text-ink">
          {patient.tokenLabel}
        </div>

        {patient.status === "called" ? (
          <div className="mt-4 rounded-xl border-2 border-turmeric bg-turmeric/10 p-4 animate-pulse">
            <span className="text-xs font-bold uppercase tracking-wider text-turmeric">
              Please Proceed to Room!
            </span>
            <div className="mt-1 text-2xl font-extrabold text-ink">
              {patient.roomLabel || "Room 1"}
            </div>
          </div>
        ) : (
          <div className="mt-5 rounded-xl border border-hairline bg-paper p-4">
            <div className="text-xs text-muted">Current Position in Queue</div>
            <div className="mt-1 text-3xl font-extrabold text-ink">
              #{queueInfo.position}
            </div>
            <div className="mt-1 text-xs text-muted">
              {queueInfo.aheadCount === 0
                ? "You are next in turn! Please stay near the room."
                : `${queueInfo.aheadCount} patient(s) ahead of you.`}
            </div>
          </div>
        )}

        {/* Priority Tier Indicator (Explainable & Reassuring) */}
        <div className="mt-5 flex justify-center">
          <LevelBadge level={patient.level} size="md" bilingual />
        </div>
      </div>

      {/* Reassurance & Triage Notice */}
      <div className="mt-6 rounded-xl border border-hairline bg-paper p-4 text-xs leading-relaxed text-ink space-y-2">
        <div className="flex items-center gap-2 font-semibold text-sandstone">
          <ShieldCheck className="size-4" />
          <span>Sickest First · आपातकालीन प्राथमिकता नियम</span>
        </div>
        <p className="text-muted">
          Government OPDs follow clinical urgency. Patients with critical medical emergencies or unstable vitals are attended to immediately to ensure safety. Your turn is actively maintained in the digital queue.
        </p>
      </div>

      {/* Red-Flag Symptoms Warning Box */}
      <div className="mt-4 rounded-xl border border-brick/30 bg-brick/5 p-4 text-xs">
        <div className="flex items-center gap-2 font-bold text-brick">
          <AlertOctagon className="size-4 shrink-0" />
          <span>When to alert the nurse immediately:</span>
        </div>
        <p className="mt-1 text-muted">
          If you feel sudden severe chest pain, extreme breathlessness, cold sweating, confusion, or dizziness while waiting, <b>please walk straight to the Nursing Desk</b> immediately!
        </p>
      </div>

      {/* Refresh Status Button */}
      <div className="mt-6 flex justify-center">
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="flex items-center gap-2 rounded-lg border border-hairline bg-card px-4 py-2 text-xs font-semibold text-ink shadow-xs hover:border-sandstone transition-colors"
        >
          <RefreshCw className="size-3.5" />
          Refresh Live Status / स्थिति ताज़ा करें
        </button>
      </div>
    </div>
  );
}
