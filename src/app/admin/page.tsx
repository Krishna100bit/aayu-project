"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Activity,
  CheckCircle2,
  FileCode2,
  RotateCcw,
  Settings,
  Shield,
  Users,
} from "lucide-react";
import departmentsData from "../../../data/departments.json";
import rulesData from "../../../data/rules.json";
import { queueStore, useQueueVisits } from "@/lib/queue-store";
import { LevelBadge } from "@/components/level-badge";
import type { Level } from "@/engine/levels";
import { cn } from "@/lib/utils";

export default function AdminPage() {
  const visits = useQueueVisits();
  const [activeTab, setActiveTab] = useState<"rules" | "departments" | "audit" | "settings">("rules");
  const [selectedRuleId, setSelectedRuleId] = useState<string>("S01");
  const [season, setSeason] = useState("normal");
  const [demoResetMessage, setDemoResetMessage] = useState(false);

  const selectedRule = rulesData.rules.find((r) => r.id === selectedRuleId) || rulesData.rules[0]!;

  const handleResetDemo = () => {
    queueStore.resetDemo();
    setDemoResetMessage(true);
    setTimeout(() => setDemoResetMessage(false), 3000);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      {/* Top Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-hairline pb-4">
        <div>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-sandstone">
            <Shield className="size-3.5" /> Clinical Administration · प्रशासनिक डैशबोर्ड
          </span>
          <h1 className="mt-1 font-serif text-2xl font-semibold text-ink sm:text-3xl">
            Triage Rules, Departments & Audit Logs
          </h1>
          <p className="text-sm text-muted">
            Configure hospital parameters, inspect deterministic rule DSL, and audit clinical overrides
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleResetDemo}
            className="flex items-center gap-1.5 rounded-lg border border-hairline bg-card px-3 py-2 text-xs font-semibold text-ink shadow-xs hover:border-sandstone transition-colors"
          >
            <RotateCcw className="size-3.5 text-sandstone" />
            Reset Demo Patients (Token 87 & 23)
          </button>
        </div>
      </div>

      {demoResetMessage && (
        <div className="mb-6 rounded-lg border border-neem bg-neem/10 p-3 text-xs font-medium text-neem">
          ✓ Demo queue reset to standard benchmark state (Token 87 Immediate, Token 23 Routine).
        </div>
      )}

      {/* Admin Tabs */}
      <div className="mb-6 flex gap-2 border-b border-hairline pb-2">
        {(
          [
            { id: "rules", label: "Triage Rules DSL", icon: FileCode2 },
            { id: "departments", label: "OPD Departments", icon: Users },
            { id: "audit", label: "Audit Log & Patients", icon: Activity },
            { id: "settings", label: "Hospital Thresholds", icon: Settings },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-colors",
                activeTab === tab.id
                  ? "bg-ink text-paper"
                  : "text-muted hover:bg-card hover:text-ink",
              )}
            >
              <Icon className="size-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab 1: Rules DSL Explorer */}
      {activeTab === "rules" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Rules List (5 cols) */}
          <div className="rounded-xl border border-hairline bg-card p-4 shadow-xs lg:col-span-5">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">
              Active Deterministic Rules ({rulesData.rules.length})
            </h2>

            <div className="mt-3 space-y-2 max-h-[600px] overflow-y-auto pr-1">
              {rulesData.rules.map((rule) => (
                <button
                  key={rule.id}
                  type="button"
                  onClick={() => setSelectedRuleId(rule.id)}
                  className={cn(
                    "flex w-full items-start justify-between rounded-lg border p-3 text-left transition-colors",
                    selectedRuleId === rule.id
                      ? "border-sandstone bg-sandstone/10 shadow-xs"
                      : "border-hairline bg-paper hover:border-sandstone/50",
                  )}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-ink">{rule.id}</span>
                      <LevelBadge level={rule.level as Level} size="sm" />
                    </div>
                    <div className="mt-1 text-xs text-muted line-clamp-1">{rule.reason_en}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Selected Rule Inspector (7 cols) */}
          <div className="rounded-xl border border-hairline bg-card p-5 shadow-xs lg:col-span-7">
            <div className="flex items-start justify-between border-b border-hairline pb-4">
              <div>
                <span className="font-mono text-xl font-bold text-ink">{selectedRule.id}</span>
                <div className="mt-1">
                  <LevelBadge level={selectedRule.level as Level} size="md" bilingual />
                </div>
              </div>
              <span className="rounded bg-paper border border-hairline px-2 py-1 font-mono text-[11px] text-muted">
                Version: {rulesData.version}
              </span>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                  English Reason:
                </span>
                <div className="mt-1 rounded-md border border-hairline bg-paper p-3 text-xs font-medium text-ink">
                  {selectedRule.reason_en}
                </div>
              </div>

              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                  Hindi Reason:
                </span>
                <div className="mt-1 rounded-md border border-hairline bg-paper p-3 font-deva text-xs text-ink">
                  {selectedRule.reason_hi}
                </div>
              </div>

              {selectedRule.tasks && selectedRule.tasks.length > 0 && (
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                    Mandatory Clinical Tasks:
                  </span>
                  <div className="mt-2 space-y-1.5">
                    {selectedRule.tasks.map((task, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 rounded-md border border-hairline bg-paper px-3 py-2 text-xs text-ink"
                      >
                        <CheckCircle2 className="size-3.5 text-turmeric shrink-0" />
                        <span>{task}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                  Condition DSL (AST JSON):
                </span>
                <pre className="mt-1 overflow-x-auto rounded-md border border-hairline bg-paper p-3 font-mono text-[11px] text-ink leading-relaxed">
                  {JSON.stringify(selectedRule.when, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Departments */}
      {activeTab === "departments" && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {departmentsData.departments.map((dept) => (
            <div
              key={dept.id}
              className="rounded-xl border border-hairline bg-card p-5 shadow-xs flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm font-bold text-sandstone">{dept.id}</span>
                  <span className="rounded bg-paper border border-hairline px-2 py-0.5 text-[10px] font-bold text-muted uppercase">
                    Active OPD
                  </span>
                </div>
                <h3 className="mt-2 text-base font-bold text-ink">{dept.name_en}</h3>
                <p className="font-deva text-xs text-muted">{dept.name_hi}</p>
              </div>

              <div className="mt-4 border-t border-hairline pt-3 flex items-center justify-between text-xs text-muted">
                <span>Avg Consult: <b>{dept.avg_consult_minutes} min</b></span>
                <Link
                  href={`/display/${dept.id}`}
                  target="_blank"
                  className="font-semibold text-sandstone hover:underline"
                >
                  View TV →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab 3: Audit Log & Patients */}
      {activeTab === "audit" && (
        <div className="rounded-xl border border-hairline bg-card p-5 shadow-xs">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted border-b border-hairline pb-3">
            Append-Only Clinical Audit Log · Triage Events
          </h2>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-hairline text-muted">
                <tr>
                  <th className="py-2">Token</th>
                  <th>Patient Name</th>
                  <th>Age/Sex</th>
                  <th>Dept</th>
                  <th>Priority Level</th>
                  <th>Source</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {visits.map((v) => (
                  <tr key={v.id} className="hover:bg-paper/50">
                    <td className="py-3 font-mono font-bold text-ink">{v.tokenLabel}</td>
                    <td className="font-medium text-ink">{v.fullName}</td>
                    <td className="text-muted">{v.ageYears}y / {v.sex}</td>
                    <td className="font-mono text-muted">{v.departmentId}</td>
                    <td>
                      <LevelBadge level={v.level} size="sm" />
                    </td>
                    <td className="text-muted capitalize">{v.levelSource}</td>
                    <td>
                      <span className="rounded bg-paper border border-hairline px-2 py-0.5 text-[10px] uppercase font-bold text-muted">
                        {v.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Hospital Thresholds */}
      {activeTab === "settings" && (
        <div className="max-w-2xl rounded-xl border border-hairline bg-card p-6 shadow-xs space-y-6">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted border-b border-hairline pb-3">
            Clinical Escalation Targets & Seasonality
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-ink">
                Immediate Escalation Target (Minutes)
              </label>
              <input
                type="number"
                defaultValue={5}
                className="mt-1 w-full rounded-md border border-hairline bg-paper p-2 text-xs text-ink focus:border-sandstone focus:outline-hidden"
              />
              <span className="text-[11px] text-muted">Alerts sent to Senior Medical Officer if uncalled.</span>
            </div>

            <div>
              <label className="block text-xs font-medium text-ink">
                Soon Escalation Target (Minutes)
              </label>
              <input
                type="number"
                defaultValue={30}
                className="mt-1 w-full rounded-md border border-hairline bg-paper p-2 text-xs text-ink focus:border-sandstone focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-ink">
                Active Season Modifier
              </label>
              <select
                value={season}
                onChange={(e) => setSeason(e.target.value)}
                className="mt-1 w-full rounded-md border border-hairline bg-paper p-2 text-xs text-ink focus:border-sandstone focus:outline-hidden"
              >
                <option value="normal">Normal (Baseline OPD)</option>
                <option value="heatwave">Jodhpur Summer Heatwave (लू / डिहाइड्रेशन सतर्कता)</option>
                <option value="monsoon">Monsoon / Dengue-Malaria Season (डेंगू/मलेरिया सतर्कता)</option>
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
