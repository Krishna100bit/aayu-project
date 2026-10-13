"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Bell,
  Clock,
  Maximize2,
  Minimize2,
  ShieldAlert,
  Volume2,
} from "lucide-react";
import departmentsData from "../../../../data/departments.json";
import { useQueueVisits } from "@/lib/queue-store";
import { LevelBadge } from "@/components/level-badge";
import { cn } from "@/lib/utils";

export default function DisplayBoardPage({
  params,
}: {
  params: Promise<{ dept: string }>;
}) {
  const resolvedParams = use(params);
  const deptCode = resolvedParams.dept.toUpperCase();
  const visits = useQueueVisits();
  const [timeStr, setTimeStr] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);

  const deptInfo = departmentsData.departments.find((d) => d.id === deptCode) || {
    id: deptCode,
    name_en: "General OPD",
    name_hi: "सामान्य ओ.पी.डी.",
  };

  // Clock
  useEffect(() => {
    const updateTime = () => {
      setTimeStr(
        new Date().toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        }),
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Currently called patients
  const calledVisits = useMemo(() => {
    return visits.filter(
      (v) => (deptCode === "ALL" || v.departmentId === deptCode) && v.status === "called",
    );
  }, [visits, deptCode]);

  // Next in queue (waiting)
  const nextWaiting = useMemo(() => {
    return visits
      .filter(
        (v) => (deptCode === "ALL" || v.departmentId === deptCode) && v.status === "waiting",
      )
      .sort((a, b) => {
        const rankMap = { IMMEDIATE: 1, SOON: 2, ROUTINE: 3 };
        const diff = rankMap[a.level] - rankMap[b.level];
        if (diff !== 0) return diff;
        return a.sortKey - b.sortKey;
      });
  }, [visits, deptCode]);

  // Check if any immediate case is active
  const hasImmediateCase = useMemo(() => {
    return visits.some((v) => v.level === "IMMEDIATE" && ["waiting", "with_nurse"].includes(v.status));
  }, [visits]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  return (
    <div className="min-h-screen bg-paper text-ink p-6 lg:p-10 flex flex-col justify-between select-none">
      {/* TV Header */}
      <header className="border-b-2 border-hairline pb-6 flex flex-wrap items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3">
            <span className="rounded-md bg-ink px-3 py-1 font-mono text-xs font-bold uppercase tracking-wider text-paper">
              OPD TV DISPLAY · टोकन प्रसारण
            </span>
            <span className="font-mono text-sm text-muted">Jodhpur District Hospital</span>
          </div>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-5xl text-ink font-serif">
            {deptInfo.name_en} <span className="font-deva font-normal text-muted">({deptInfo.name_hi})</span>
          </h1>
        </div>

        <div className="flex items-center gap-6">
          <div className="text-right">
            <div className="font-mono text-3xl font-bold tracking-tight text-ink sm:text-4xl">
              {timeStr}
            </div>
            <div className="text-xs text-muted">Priority Queue Display Board</div>
          </div>
          <button
            type="button"
            onClick={toggleFullscreen}
            className="rounded-lg border border-hairline bg-card p-3 text-muted hover:text-ink shadow-xs"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="size-5" /> : <Maximize2 className="size-5" />}
          </button>
        </div>
      </header>

      {/* Emergency Active Notice */}
      {hasImmediateCase && (
        <div className="mt-6 flex items-center gap-3 rounded-xl border-2 border-brick bg-brick/10 px-6 py-4 shadow-sm animate-pulse">
          <ShieldAlert className="size-7 text-brick shrink-0" />
          <div>
            <div className="text-sm font-bold uppercase tracking-wider text-brick">
              Clinical Priority in Effect · आपातकालीन प्राथमिकता सक्रिय
            </div>
            <div className="text-xs text-ink/80">
              Doctors are actively treating critical emergency cases. We appreciate your patience. (बीमार पहले, क्रम बाद में)
            </div>
          </div>
        </div>
      )}

      {/* Main Grid: Called Tokens (Left) & Next in Queue (Right) */}
      <main className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-12 flex-1">
        {/* Left: Now Calling to Room (7 cols) */}
        <div className="lg:col-span-7 flex flex-col">
          <div className="flex items-center justify-between border-b border-hairline pb-3">
            <span className="text-sm font-bold uppercase tracking-widest text-muted flex items-center gap-2">
              <Volume2 className="size-4 text-sandstone" />
              Now Calling · कक्ष में पधारें
            </span>
            <span className="font-mono text-xs text-muted">High Visibility</span>
          </div>

          <div className="mt-6 flex-1 space-y-5">
            {calledVisits.length === 0 ? (
              <div className="flex h-64 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-hairline p-8 text-center text-muted">
                <Bell className="size-12 stroke-[1.25] text-muted/40" />
                <p className="mt-3 text-lg font-medium">Doctors preparing consult room...</p>
                <p className="text-sm">Tokens will be announced here.</p>
              </div>
            ) : (
              calledVisits.map((v) => (
                <div
                  key={v.id}
                  className="flex items-center justify-between rounded-2xl border-4 border-ink bg-card p-6 shadow-md transition-all animate-in fade-in zoom-in-95"
                >
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-muted">
                      Token Number / टोकन संख्या
                    </div>
                    <div className="font-mono text-5xl font-black tracking-tight text-ink sm:text-6xl">
                      {v.tokenLabel}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-xs font-bold uppercase tracking-wider text-sandstone">
                      Proceed To / कृपया पधारें
                    </div>
                    <div className="mt-1 font-mono text-4xl font-extrabold text-ink sm:text-5xl">
                      {v.roomLabel || "Room 1"}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right: Next Waiting Queue (5 cols) */}
        <div className="lg:col-span-5 flex flex-col">
          <div className="flex items-center justify-between border-b border-hairline pb-3">
            <span className="text-sm font-bold uppercase tracking-widest text-muted flex items-center gap-2">
              <Clock className="size-4 text-muted" />
              Next Up in Queue · आगामी टोकन
            </span>
            <span className="font-mono text-xs text-muted">Privacy Safe</span>
          </div>

          <div className="mt-6 flex-1 space-y-3">
            {nextWaiting.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-hairline p-8 text-center text-sm text-muted">
                No other patients waiting.
              </div>
            ) : (
              nextWaiting.slice(0, 7).map((v, idx) => (
                <div
                  key={v.id}
                  className={cn(
                    "flex items-center justify-between rounded-xl border p-4 shadow-xs",
                    v.level === "IMMEDIATE" ? "border-brick/40 bg-brick/5" : "border-hairline bg-card",
                  )}
                >
                  <div className="flex items-center gap-4">
                    <span className="font-mono text-sm font-bold text-muted w-6">
                      #{idx + 1}
                    </span>
                    <span className="font-mono text-2xl font-bold tracking-tight text-ink">
                      {v.tokenLabel}
                    </span>
                  </div>

                  {/* Level Shape Indicator */}
                  <div className="flex items-center gap-2">
                    <LevelBadge level={v.level} size="sm" />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>

      {/* Footer Disclaimer */}
      <footer className="mt-8 border-t border-hairline pt-4 flex flex-wrap items-center justify-between text-xs text-muted">
        <div>
          Hospital OPD Priority System · <b>Sickest first, not first come.</b> (सबसे गंभीर मरीज़ को प्राथमिकता)
        </div>
        <div className="font-mono text-[11px]">
          TriageLane Live Display · Audio Announcements Enabled
        </div>
      </footer>
    </div>
  );
}
