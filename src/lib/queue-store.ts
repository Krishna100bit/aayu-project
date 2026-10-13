"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
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

const STORAGE_KEY = "tl_visits_v1";

const INITIAL_VISITS: PatientVisit[] = [
  {
    id: "v-87",
    uhid: "UHID-2026-087",
    fullName: "Rameshwar Prasad (रामेश्वर प्रसाद)",
    ageYears: 58,
    sex: "M",
    phone: "9829012345",
    departmentId: "GEN_MED",
    tokenNo: 87,
    tokenLabel: "GEN_MED-087",
    statusCode: "t87red",
    visitDate: "2026-10-13",
    registeredAt: new Date(Date.now() - 14 * 60 * 1000).toISOString(),
    status: "waiting",
    level: "IMMEDIATE",
    levelSource: "system",
    reasonEn: "Chest pain with sweating (red-flag rule S01). High clinical risk.",
    reasonHi: "सीने में दर्द व पसीना (नियम S01)। तत्काल चिकित्सा आवश्यक।",
    firedRules: ["S01"],
    tasks: ["Immediate 12-lead ECG", "Shift to Red Resuscitation Bay", "Alert Medical Officer"],
    symptomTags: ["chest_pain", "sweating", "breathless_rest"],
    freeText: "Sudden heavy chest tightness while walking, sweating profusely",
    sortKey: 10,
  },
  {
    id: "v-91",
    uhid: "UHID-2026-091",
    fullName: "Kamla Devi (कमला देवी)",
    ageYears: 67,
    sex: "F",
    phone: "9829054321",
    departmentId: "GEN_MED",
    tokenNo: 91,
    tokenLabel: "GEN_MED-091",
    statusCode: "t91red",
    visitDate: "2026-10-13",
    registeredAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
    status: "with_nurse",
    level: "IMMEDIATE",
    levelSource: "nurse",
    reasonEn: "Severe respiratory distress with SpO2 88% on room air",
    reasonHi: "गंभीर साँस फूलना व ऑक्सीजन 88%।",
    firedRules: ["V02", "APLS_HYPOXIA"],
    tasks: ["High flow oxygen mask", "Nebulization stat", "Physician review"],
    symptomTags: ["breathless", "blue_lips"],
    vitals: { rr: 32, spo2: 88, hr: 118, sbp: 154, dbp: 96, consciousness: "ALERT" },
    sortKey: 20,
  },
  {
    id: "v-42",
    uhid: "UHID-2026-042",
    fullName: "Aarav Sharma (आरव शर्मा)",
    ageYears: 3,
    sex: "M",
    phone: "9876543210",
    departmentId: "PAED",
    tokenNo: 42,
    tokenLabel: "PAED-042",
    statusCode: "t42soon",
    visitDate: "2026-10-13",
    registeredAt: new Date(Date.now() - 32 * 60 * 1000).toISOString(),
    status: "waiting",
    level: "SOON",
    levelSource: "system",
    reasonEn: "High fever >39°C with persistent vomiting in toddler (APLS caution)",
    reasonHi: "तेज़ बुखार व लगातार उल्टी। प्राथमिकता जांच।",
    firedRules: ["APLS_FEVER", "AGE_PEDIATRIC"],
    tasks: ["Paracetamol oral drops", "ORS sips", "Vitals monitoring"],
    symptomTags: ["fever", "persistent_vomiting"],
    vitals: { temp_c: 39.2, hr: 138, consciousness: "ALERT" },
    sortKey: 100,
  },
  {
    id: "v-15",
    uhid: "UHID-2026-015",
    fullName: "Suraj Mal Gehlot (सूरज मल गहलोत)",
    ageYears: 74,
    sex: "M",
    phone: "9414011223",
    departmentId: "GEN_MED",
    tokenNo: 15,
    tokenLabel: "GEN_MED-015",
    statusCode: "t15soon",
    visitDate: "2026-10-13",
    registeredAt: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
    status: "waiting",
    level: "SOON",
    levelSource: "system",
    reasonEn: "Elderly patient (age ≥65) with infected foot ulcer & high glucose",
    reasonHi: "वरिष्ठ नागरिक (आयु 74) पाँव में घाव व शुगर की समस्या।",
    firedRules: ["MOD_ELDERLY", "V_GLUCOSE_HIGH"],
    tasks: ["Capillary Blood Glucose check", "Foot wound dressing"],
    symptomTags: ["wound", "diabetic_review"],
    vitals: { sbp: 142, dbp: 88, hr: 82, glucose_mgdl: 285, consciousness: "ALERT" },
    sortKey: 110,
  },
  {
    id: "v-23",
    uhid: "UHID-2026-023",
    fullName: "Sunita Choudhary (सुनीता चौधरी)",
    ageYears: 34,
    sex: "F",
    phone: "9166099887",
    departmentId: "DERM",
    tokenNo: 23,
    tokenLabel: "DERM-023",
    statusCode: "t23routine",
    visitDate: "2026-10-13",
    registeredAt: new Date(Date.now() - 55 * 60 * 1000).toISOString(),
    status: "waiting",
    level: "ROUTINE",
    levelSource: "system",
    reasonEn: "Mild localized rash without systemic signs. Standard OPD order.",
    reasonHi: "सामान्य त्वचा पर लालिमा/चकत्ते। नियमित क्रम।",
    firedRules: ["R_DEFAULT"],
    tasks: ["Routine examination"],
    symptomTags: ["skin_rash", "itching"],
    vitals: { rr: 16, spo2: 99, hr: 74, sbp: 118, dbp: 76, consciousness: "ALERT" },
    sortKey: 200,
  },
  {
    id: "v-04",
    uhid: "UHID-2026-004",
    fullName: "Pooja Bishnoi (पूजा बिश्नोई)",
    ageYears: 26,
    sex: "F",
    pregnant: true,
    phone: "9461234567",
    departmentId: "OBG",
    tokenNo: 4,
    tokenLabel: "OBG-004",
    statusCode: "t04obg",
    visitDate: "2026-10-13",
    registeredAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    status: "waiting",
    level: "ROUTINE",
    levelSource: "system",
    reasonEn: "Antenatal routine 2nd trimester check-up. Normal baseline.",
    reasonHi: "गर्भावस्था नियमित जाँच। नियमित क्रम।",
    firedRules: ["R_DEFAULT"],
    tasks: ["Fetal heart rate auscultation", "Weight & Urine dipstick"],
    symptomTags: ["routine_checkup", "antenatal_review"],
    vitals: { sbp: 110, dbp: 70, hr: 78, consciousness: "ALERT" },
    sortKey: 210,
  },
  {
    id: "v-55",
    uhid: "UHID-2026-055",
    fullName: "Dinesh Bhati (दिनेश भाटी)",
    ageYears: 42,
    sex: "M",
    phone: "9828881122",
    departmentId: "ORTHO",
    tokenNo: 55,
    tokenLabel: "ORTHO-055",
    statusCode: "t55ortho",
    visitDate: "2026-10-13",
    registeredAt: new Date(Date.now() - 75 * 60 * 1000).toISOString(),
    status: "called",
    roomLabel: "Room 3",
    level: "ROUTINE",
    levelSource: "system",
    reasonEn: "Right knee pain on climbing stairs. Stable vital signs.",
    reasonHi: "दाहिने घुटने में दर्द। नियमित क्रम।",
    firedRules: ["R_DEFAULT"],
    tasks: ["Knee X-ray AP/Lat review"],
    symptomTags: ["joint_pain"],
    sortKey: 220,
  },
];

let memoryVisits: PatientVisit[] = INITIAL_VISITS;
const listeners = new Set<() => void>();

function getStoredVisits(): PatientVisit[] {
  if (typeof window === "undefined") return INITIAL_VISITS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_VISITS));
      return INITIAL_VISITS;
    }
    return JSON.parse(raw) as PatientVisit[];
  } catch {
    return memoryVisits;
  }
}

function notify() {
  listeners.forEach((l) => l());
}

function save(visits: PatientVisit[]) {
  memoryVisits = visits;
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(visits));
    } catch {
      // ignore
    }
  }
  notify();
}

export const queueStore = {
  getVisits(): PatientVisit[] {
    return memoryVisits;
  },

  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  addVisit(visitData: Omit<PatientVisit, "id" | "tokenNo" | "tokenLabel" | "statusCode" | "visitDate" | "registeredAt" | "status" | "sortKey">): PatientVisit {
    const current = getStoredVisits();
    const deptVisits = current.filter((v) => v.departmentId === visitData.departmentId);
    const maxNo = deptVisits.reduce((acc, v) => Math.max(acc, v.tokenNo), 0);
    const nextNo = maxNo + 1;
    const tokenLabel = `${visitData.departmentId}-${String(nextNo).padStart(3, "0")}`;
    const statusCode = Math.random().toString(36).substring(2, 9);

    const newVisit: PatientVisit = {
      ...visitData,
      id: `v-${Date.now()}`,
      tokenNo: nextNo,
      tokenLabel,
      statusCode,
      visitDate: new Date().toISOString().slice(0, 10),
      registeredAt: new Date().toISOString(),
      status: "waiting",
      sortKey: visitData.level === "IMMEDIATE" ? 10 : visitData.level === "SOON" ? 100 : 200,
    };

    save([newVisit, ...current]);
    return newVisit;
  },

  updateVitals(visitId: string, vitals: NonNullable<PatientVisit["vitals"]>, autoLevel?: Level, tasks?: string[]) {
    const current = getStoredVisits();
    const updated = current.map((v) => {
      if (v.id !== visitId) return v;
      return {
        ...v,
        vitals: { ...(v.vitals || {}), ...vitals },
        level: autoLevel ?? v.level,
        tasks: tasks ?? v.tasks,
        status: v.status === "registered" ? ("waiting" as const) : v.status,
      };
    });
    save(updated);
  },

  overrideLevel(visitId: string, newLevel: Level, reasonCode: string, note?: string) {
    const current = getStoredVisits();
    const updated = current.map((v) => {
      if (v.id !== visitId) return v;
      return {
        ...v,
        level: newLevel,
        levelSource: "nurse" as const,
        overrideReason: `${reasonCode}: ${note || "Clinical assessment override"}`,
        sortKey: newLevel === "IMMEDIATE" ? 5 : newLevel === "SOON" ? 95 : 195,
      };
    });
    save(updated);
  },

  reorderWithinLane(departmentId: string, level: Level, movedId: string, targetId: string) {
    const current = getStoredVisits();
    const laneVisits = current.filter((v) => v.departmentId === departmentId && v.level === level);
    const fromIndex = laneVisits.findIndex((v) => v.id === movedId);
    const toIndex = laneVisits.findIndex((v) => v.id === targetId);
    if (fromIndex === -1 || toIndex === -1) return;

    const copy = [...laneVisits];
    const [item] = copy.splice(fromIndex, 1);
    copy.splice(toIndex, 0, item);

    // Reassign sort keys
    const base = level === "IMMEDIATE" ? 10 : level === "SOON" ? 100 : 200;
    const keyMap = new Map(copy.map((v, idx) => [v.id, base + idx * 5]));

    const updated = current.map((v) => {
      if (keyMap.has(v.id)) {
        return { ...v, sortKey: keyMap.get(v.id)! };
      }
      return v;
    });
    save(updated);
  },

  callPatient(visitId: string, roomLabel = "Room 1") {
    const current = getStoredVisits();
    const updated = current.map((v) => {
      if (v.id !== visitId) return v;
      return {
        ...v,
        status: "called" as const,
        calledAt: new Date().toISOString(),
        roomLabel,
      };
    });
    save(updated);
  },

  startConsult(visitId: string) {
    const current = getStoredVisits();
    const updated = current.map((v) => {
      if (v.id !== visitId) return v;
      return {
        ...v,
        status: "in_consult" as const,
        consultStart: new Date().toISOString(),
      };
    });
    save(updated);
  },

  finishConsult(visitId: string) {
    const current = getStoredVisits();
    const updated = current.map((v) => {
      if (v.id !== visitId) return v;
      return {
        ...v,
        status: "done" as const,
        consultEnd: new Date().toISOString(),
      };
    });
    save(updated);
  },

  transferEmergency(visitId: string) {
    const current = getStoredVisits();
    const updated = current.map((v) => {
      if (v.id !== visitId) return v;
      return {
        ...v,
        status: "sent_emergency" as const,
        level: "IMMEDIATE" as const,
        departmentId: "EMERG",
      };
    });
    save(updated);
  },

  changeDepartment(visitId: string, newDept: string) {
    const current = getStoredVisits();
    const updated = current.map((v) => {
      if (v.id !== visitId) return v;
      return {
        ...v,
        departmentId: newDept,
      };
    });
    save(updated);
  },

  resetDemo() {
    save(INITIAL_VISITS);
  },
};

export function useQueueVisits() {
  const [visits, setVisits] = useState<PatientVisit[]>(() => getStoredVisits());

  useEffect(() => {
    // Sync initial from localStorage on client mount
    setVisits(getStoredVisits());
    return queueStore.subscribe(() => {
      setVisits(getStoredVisits());
    });
  }, []);

  return visits;
}
