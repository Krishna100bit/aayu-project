"use client";

import { useEffect, useState } from "react";
import type { Level } from "@/engine/levels";

export interface PatientVisit {
  id: string;
  uhid?: string;
  fullName: string;
  ageYears: number;
  sex: "M" | "F" | "O";
  phone?: string;
  pregnant?: boolean;
  departmentId: string;
  tokenNo: number;
  tokenLabel: string;
  statusCode: string;
  visitDate: string;
  registeredAt: string;
  triagedAt?: string;
  calledAt?: string;
  consultStart?: string;
  consultEnd?: string;
  status:
    | "registered"
    | "with_nurse"
    | "waiting"
    | "called"
    | "in_consult"
    | "done"
    | "skipped"
    | "sent_emergency";
  roomLabel?: string;
  level: Level;
  levelSource: "system" | "nurse" | "doctor";
  reasonEn: string;
  reasonHi: string;
  firedRules: string[];
  tasks: string[];
  needsVerification?: boolean;
  symptomTags: string[];
  freeText?: string;
  vitals?: {
    rr?: number;
    spo2?: number;
    sbp?: number;
    dbp?: number;
    hr?: number;
    temp_c?: number;
    consciousness?: "ALERT" | "VOICE" | "PAIN" | "UNRESPONSIVE";
    glucose_mgdl?: number;
    pain_0_10?: number;
  };
  overrideReason?: string;
  sortKey: number;
}

let memoryVisits: PatientVisit[] = [];
let hasFetchedInitially = false;
let isFetching = false;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

function setMemoryVisits(visits: PatientVisit[]) {
  memoryVisits = visits;
  notify();
}

export async function fetchQueueVisits(department?: string): Promise<PatientVisit[]> {
  try {
    isFetching = true;
    const url = department && department !== "ALL" ? `/api/visits?department=${encodeURIComponent(department)}` : `/api/visits`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to fetch visits");
    const data: PatientVisit[] = await res.json();
    setMemoryVisits(data);
    hasFetchedInitially = true;
    return data;
  } catch (err) {
    console.error("fetchQueueVisits error:", err);
    return memoryVisits;
  } finally {
    isFetching = false;
  }
}

export const queueStore = {
  getVisits(): PatientVisit[] {
    return memoryVisits;
  },

  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  async refresh(department?: string): Promise<void> {
    await fetchQueueVisits(department);
  },

  async addVisit(
    visitData: Omit<
      PatientVisit,
      "id" | "tokenNo" | "tokenLabel" | "statusCode" | "visitDate" | "registeredAt" | "status" | "sortKey"
    >,
  ): Promise<PatientVisit> {
    try {
      const res = await fetch("/api/visits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(visitData),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to register visit");
      }
      const created: PatientVisit = await res.json();
      setMemoryVisits([created, ...memoryVisits]);
      return created;
    } catch (err) {
      console.error("addVisit API error, falling back locally:", err);
      // Fallback local creation if offline
      const nextNo = memoryVisits.length + 1;
      const fallback: PatientVisit = {
        ...visitData,
        id: `v-${Date.now()}`,
        tokenNo: nextNo,
        tokenLabel: `${visitData.departmentId}-${String(nextNo).padStart(3, "0")}`,
        statusCode: Math.random().toString(36).substring(2, 9),
        visitDate: new Date().toISOString().slice(0, 10),
        registeredAt: new Date().toISOString(),
        status: "waiting",
        sortKey: visitData.level === "IMMEDIATE" ? 10 : visitData.level === "SOON" ? 100 : 200,
      };
      setMemoryVisits([fallback, ...memoryVisits]);
      return fallback;
    }
  },

  async updateVitals(
    visitId: string,
    vitals: NonNullable<PatientVisit["vitals"]>,
    autoLevel?: Level,
    tasks?: string[],
  ): Promise<void> {
    // Optimistic UI update
    const previous = memoryVisits;
    setMemoryVisits(
      previous.map((v) =>
        v.id === visitId
          ? {
              ...v,
              vitals: { ...(v.vitals || {}), ...vitals },
              level: autoLevel ?? v.level,
              tasks: tasks ?? v.tasks,
              status: v.status === "registered" ? "waiting" : v.status,
            }
          : v,
      ),
    );

    try {
      const res = await fetch(`/api/visits/${visitId}/vitals`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vitals }),
      });
      if (res.ok) {
        const updated: PatientVisit = await res.json();
        setMemoryVisits(memoryVisits.map((v) => (v.id === visitId ? updated : v)));
      }
    } catch (err) {
      console.error("updateVitals error:", err);
    }
  },

  async overrideLevel(visitId: string, newLevel: Level, reasonCode: string, note?: string): Promise<void> {
    // Optimistic UI update
    setMemoryVisits(
      memoryVisits.map((v) =>
        v.id === visitId
          ? {
              ...v,
              level: newLevel,
              levelSource: "nurse",
              overrideReason: `${reasonCode}: ${note || "Clinical assessment override"}`,
              sortKey: newLevel === "IMMEDIATE" ? 5 : newLevel === "SOON" ? 95 : 195,
            }
          : v,
      ),
    );

    try {
      const res = await fetch(`/api/visits/${visitId}/override`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newLevel, reasonCode, note }),
      });
      if (res.ok) {
        const updated: PatientVisit = await res.json();
        setMemoryVisits(memoryVisits.map((v) => (v.id === visitId ? updated : v)));
      }
    } catch (err) {
      console.error("overrideLevel error:", err);
    }
  },

  async reorderWithinLane(
    departmentId: string,
    level: Level,
    movedId: string,
    targetId: string,
  ): Promise<void> {
    const laneVisits = memoryVisits.filter((v) => v.departmentId === departmentId && v.level === level);
    const fromIndex = laneVisits.findIndex((v) => v.id === movedId);
    const toIndex = laneVisits.findIndex((v) => v.id === targetId);
    if (fromIndex === -1 || toIndex === -1) return;

    const copy = [...laneVisits];
    const [item] = copy.splice(fromIndex, 1);
    if (!item) return;
    copy.splice(toIndex, 0, item);

    const base = level === "IMMEDIATE" ? 10 : level === "SOON" ? 100 : 200;
    const keyMap = new Map(copy.map((v, idx) => [v.id, base + idx * 5]));

    const updatedList = memoryVisits.map((v) => {
      if (keyMap.has(v.id)) {
        return { ...v, sortKey: keyMap.get(v.id)! };
      }
      return v;
    });

    setMemoryVisits(updatedList);

    const updates = Array.from(keyMap.entries()).map(([id, sortKey]) => ({ id, sortKey }));
    try {
      await fetch("/api/visits/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });
    } catch (err) {
      console.error("reorderWithinLane error:", err);
    }
  },

  async callPatient(visitId: string, roomLabel = "Room 1"): Promise<void> {
    setMemoryVisits(
      memoryVisits.map((v) =>
        v.id === visitId
          ? {
              ...v,
              status: "called",
              calledAt: new Date().toISOString(),
              roomLabel,
            }
          : v,
      ),
    );

    try {
      await fetch(`/api/visits/${visitId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "called", roomLabel }),
      });
    } catch (err) {
      console.error("callPatient error:", err);
    }
  },

  async startConsult(visitId: string): Promise<void> {
    setMemoryVisits(
      memoryVisits.map((v) =>
        v.id === visitId
          ? {
              ...v,
              status: "in_consult",
              consultStart: new Date().toISOString(),
            }
          : v,
      ),
    );

    try {
      await fetch(`/api/visits/${visitId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "in_consult" }),
      });
    } catch (err) {
      console.error("startConsult error:", err);
    }
  },

  async finishConsult(visitId: string): Promise<void> {
    setMemoryVisits(
      memoryVisits.map((v) =>
        v.id === visitId
          ? {
              ...v,
              status: "done",
              consultEnd: new Date().toISOString(),
            }
          : v,
      ),
    );

    try {
      await fetch(`/api/visits/${visitId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "done" }),
      });
    } catch (err) {
      console.error("finishConsult error:", err);
    }
  },

  async transferEmergency(visitId: string): Promise<void> {
    setMemoryVisits(
      memoryVisits.map((v) =>
        v.id === visitId
          ? {
              ...v,
              status: "sent_emergency",
              level: "IMMEDIATE",
              departmentId: "EMERG",
            }
          : v,
      ),
    );

    try {
      await fetch(`/api/visits/${visitId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "sent_emergency", departmentId: "EMERG" }),
      });
    } catch (err) {
      console.error("transferEmergency error:", err);
    }
  },

  async changeDepartment(visitId: string, newDept: string): Promise<void> {
    setMemoryVisits(
      memoryVisits.map((v) => (v.id === visitId ? { ...v, departmentId: newDept } : v)),
    );

    try {
      await fetch(`/api/visits/${visitId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ departmentId: newDept }),
      });
    } catch (err) {
      console.error("changeDepartment error:", err);
    }
  },

  resetDemo() {
    // Re-fetch clean state from database
    fetchQueueVisits();
  },
};

export function useQueueVisits(department?: string) {
  const [visits, setVisits] = useState<PatientVisit[]>(() => memoryVisits);

  useEffect(() => {
    // Initial fetch from live database API
    fetchQueueVisits(department).then((data) => {
      setVisits(data);
    });

    const unsubscribe = queueStore.subscribe(() => {
      setVisits([...memoryVisits]);
    });

    // Auto-poll every 5 seconds to sync changes from other tabs/users
    const interval = setInterval(() => {
      fetchQueueVisits(department);
    }, 5000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [department]);

  return visits;
}
