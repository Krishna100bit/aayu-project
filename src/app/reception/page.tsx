"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertOctagon,
  Check,
  CheckCircle2,
  Mic,
  MicOff,
  Printer,
  QrCode,
  Search,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import symptomsData from "../../../data/symptoms.json";
import tagsData from "../../../data/tags.json";
import departmentsData from "../../../data/departments.json";
import { evaluatePatientTriage } from "@/engine/client-eval";
import { LevelBadge } from "@/components/level-badge";
import { queueStore, useQueueVisits, type PatientVisit } from "@/lib/queue-store";
import { cn } from "@/lib/utils";

interface SymptomTile {
  id: string;
  icon: string;
  en: string;
  hi: string;
  category: string;
  suggested_dept: string;
  followups?: string[];
  synonyms?: string[];
  red_flag_candidate?: boolean;
}

const TILES: SymptomTile[] = symptomsData.tiles as SymptomTile[];
const CATEGORIES: string[] = ["All", ...symptomsData.categories];
const TAGS_MAP = new Map(tagsData.tags.map((t) => [t.id, t]));

export default function ReceptionPage() {
  const visits = useQueueVisits();

  // Patient Demographics State
  const [fullName, setFullName] = useState("");
  const [ageYears, setAgeYears] = useState<number | "">("");
  const [sex, setSex] = useState<"M" | "F" | "O">("M");
  const [pregnant, setPregnant] = useState(false);
  const [phone, setPhone] = useState("");
  const [consentNotify, setConsentNotify] = useState(true);

  // Symptoms Selection State
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [freeText, setFreeText] = useState("");
  const [isRecording, setIsRecording] = useState(false);

  // Active Follow-up Modal State
  const [activeFollowupTile, setActiveFollowupTile] = useState<SymptomTile | null>(null);

  // Department Selection
  const [overrideDept, setOverrideDept] = useState<string>("");

  // Token Print Modal State
  const [printedVisit, setPrintedVisit] = useState<PatientVisit | null>(null);

  // Filtered Tiles
  const filteredTiles = useMemo(() => {
    return TILES.filter((tile) => {
      const matchCat = selectedCategory === "All" || tile.category === selectedCategory;
      if (!matchCat) return false;
      if (!searchQuery.trim()) return true;

      const q = searchQuery.toLowerCase();
      const matchEn = tile.en.toLowerCase().includes(q);
      const matchHi = tile.hi.toLowerCase().includes(q);
      const matchSynonyms = tile.synonyms?.some((s) => s.toLowerCase().includes(q));
      return matchEn || matchHi || matchSynonyms;
    });
  }, [selectedCategory, searchQuery]);

  // Real-time pure engine evaluation
  const triageResult = useMemo(() => {
    const age = typeof ageYears === "number" ? ageYears : 30;
    return evaluatePatientTriage({
      age_years: age,
      sex,
      pregnant: sex === "F" ? pregnant : false,
      tags: selectedTagIds,
      conditions: [],
      free_text: freeText || undefined,
      vitals: {},
    });
  }, [ageYears, sex, pregnant, selectedTagIds, freeText]);

  // Suggested Department
  const effectiveDept = useMemo(() => {
    if (overrideDept) return overrideDept;
    for (const tagId of selectedTagIds) {
      const tile = TILES.find((t) => t.id === tagId);
      if (tile?.suggested_dept) return tile.suggested_dept;
    }
    if (typeof ageYears === "number" && ageYears <= 14) return "PAED";
    if (sex === "F" && pregnant) return "OBG";
    return "GEN_MED";
  }, [overrideDept, selectedTagIds, ageYears, sex, pregnant]);

  // Toggle Tile Selection
  const handleTileClick = (tile: SymptomTile) => {
    const isSelected = selectedTagIds.includes(tile.id);
    if (isSelected) {
      // Deselect tile and its followups
      const toRemove = new Set([tile.id, ...(tile.followups || [])]);
      setSelectedTagIds((prev) => prev.filter((id) => !toRemove.has(id)));
    } else {
      setSelectedTagIds((prev) => [...prev, tile.id]);
      if (tile.red_flag_candidate && tile.followups && tile.followups.length > 0) {
        setActiveFollowupTile(tile);
      }
    }
  };

  // Toggle Tag in Follow-up
  const toggleTag = (tagId: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId],
    );
  };

  // Voice dictation simulation/handler
  const handleVoiceToggle = () => {
    if (!isRecording) {
      setIsRecording(true);
      // Fallback demo speech transcript if Web Speech API isn't triggered
      setTimeout(() => {
        setFreeText("सीने में अचानक तेज़ दर्द, पसीना आ रहा है और चक्कर आ रहे हैं");
        setSelectedTagIds((prev) => Array.from(new Set([...prev, "chest_pain", "sweating"])));
        setIsRecording(false);
      }, 2400);
    } else {
      setIsRecording(false);
    }
  };

  // Submit registration
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || ageYears === "") {
      alert("Please enter patient name and age");
      return;
    }

    const newVisit = await queueStore.addVisit({
      fullName: fullName.trim(),
      ageYears: Number(ageYears),
      sex,
      pregnant: sex === "F" ? pregnant : false,
      phone: phone.trim() || undefined,
      departmentId: effectiveDept,
      level: triageResult.level,
      levelSource: "system",
      reasonEn: triageResult.reason_en,
      reasonHi: triageResult.reason_hi,
      firedRules: triageResult.fired_rules,
      tasks: triageResult.tasks,
      symptomTags: selectedTagIds,
      freeText: freeText.trim() || undefined,
      vitals: {},
    });

    setPrintedVisit(newVisit);

    // Reset Form
    setFullName("");
    setAgeYears("");
    setSex("M");
    setPregnant(false);
    setPhone("");
    setSelectedTagIds([]);
    setFreeText("");
    setOverrideDept("");
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      {/* Top Banner / Role Status */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-hairline pb-4">
        <div>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-sandstone">
            <UserPlus className="size-3.5" /> OPD Reception Desk · काउंटर 1
          </span>
          <h1 className="mt-1 font-serif text-2xl font-semibold text-ink sm:text-3xl">
            Patient Intake & Priority Registration
          </h1>
          <p className="text-sm text-muted">
            प्रवेश एवं प्राथमिकता पंजीकरण · Deterministic triage evaluation in real-time
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/nurse"
            className="inline-flex items-center gap-1.5 rounded-md border border-hairline bg-card px-3 py-2 text-xs font-medium text-ink shadow-xs hover:border-sandstone transition-colors"
          >
            <Activity className="size-3.5 text-sandstone" />
            Go to Nurse Triage
          </Link>
          <Link
            href="/display/GEN_MED"
            target="_blank"
            className="inline-flex items-center gap-1.5 rounded-md border border-hairline bg-card px-3 py-2 text-xs font-medium text-ink shadow-xs hover:border-sandstone transition-colors"
          >
            <Users className="size-3.5 text-sandstone" />
            Open TV Display
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Left Column: Intake Form & Symptom Tiles (8 cols) */}
        <div className="space-y-6 lg:col-span-8">
          {/* Patient Demographics Card */}
          <div className="rounded-xl border border-hairline bg-card p-5 shadow-xs">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
              1. Patient Demographics · मरीज़ का विवरण
            </h2>

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-12">
              <div className="sm:col-span-6">
                <label className="block text-xs font-medium text-ink">
                  Full Name / पूरा नाम <span className="text-brick">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rameshwar Prasad"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="mt-1 w-full rounded-md border border-hairline bg-paper px-3 py-2 text-sm text-ink placeholder:text-muted/60 focus:border-sandstone focus:outline-hidden"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-xs font-medium text-ink">
                  Age / उम्र <span className="text-brick">*</span>
                </label>
                <input
                  type="number"
                  required
                  min={0}
                  max={120}
                  placeholder="Yrs"
                  value={ageYears}
                  onChange={(e) => setAgeYears(e.target.value === "" ? "" : Number(e.target.value))}
                  className="mt-1 w-full rounded-md border border-hairline bg-paper px-3 py-2 text-sm text-ink placeholder:text-muted/60 focus:border-sandstone focus:outline-hidden"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-xs font-medium text-ink">Sex / लिंग</label>
                <div className="mt-1 flex rounded-md border border-hairline bg-paper p-0.5">
                  {(["M", "F", "O"] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSex(s)}
                      className={cn(
                        "flex-1 rounded py-1.5 text-xs font-medium transition-colors",
                        sex === s ? "bg-ink text-paper" : "text-muted hover:text-ink",
                      )}
                    >
                      {s === "M" ? "Male (पु)" : s === "F" ? "Female (स्त्री)" : "Other"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="sm:col-span-6">
                <label className="block text-xs font-medium text-ink">
                  Phone Number / मोबाइल नंबर (10 अंक)
                </label>
                <input
                  type="tel"
                  placeholder="e.g. 9829012345"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="mt-1 w-full rounded-md border border-hairline bg-paper px-3 py-2 text-sm text-ink placeholder:text-muted/60 focus:border-sandstone focus:outline-hidden"
                />
              </div>

              <div className="flex flex-col justify-end sm:col-span-6">
                <div className="flex items-center gap-4">
                  {sex === "F" && typeof ageYears === "number" && ageYears >= 12 && ageYears <= 50 && (
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-hairline bg-paper px-3 py-2 text-xs font-medium text-ink">
                      <input
                        type="checkbox"
                        checked={pregnant}
                        onChange={(e) => setPregnant(e.target.checked)}
                        className="rounded border-hairline text-sandstone"
                      />
                      Pregnant? / गर्भवती?
                    </label>
                  )}
                  <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-muted">
                    <input
                      type="checkbox"
                      checked={consentNotify}
                      onChange={(e) => setConsentNotify(e.target.checked)}
                      className="rounded border-hairline text-sandstone"
                    />
                    SMS / WhatsApp Queue updates
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Bilingual Symptom Tile Grid */}
          <div className="rounded-xl border border-hairline bg-card p-5 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
                  2. Presenting Complaints · लक्षण
                </h2>
                <p className="text-xs text-muted">Tap tiles or search. Red dots indicate critical flag candidates.</p>
              </div>

              {/* Search Box */}
              <div className="relative w-full sm:w-64">
                <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted" />
                <input
                  type="text"
                  placeholder="Search symptom / लक्षण खोजें..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-md border border-hairline bg-paper py-1.5 pl-9 pr-3 text-xs text-ink placeholder:text-muted/60 focus:border-sandstone focus:outline-hidden"
                />
              </div>
            </div>

            {/* Category Filter Pills */}
            <div className="no-scrollbar mt-4 flex gap-1.5 overflow-x-auto pb-1">
              {CATEGORIES.slice(0, 10).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={cn(
                    "whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition-colors",
                    selectedCategory === cat
                      ? "bg-ink text-paper"
                      : "border border-hairline bg-paper text-muted hover:border-sandstone hover:text-ink",
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Tile Grid */}
            <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4">
              {filteredTiles.slice(0, 24).map((tile) => {
                const isSelected = selectedTagIds.includes(tile.id);
                return (
                  <button
                    key={tile.id}
                    type="button"
                    onClick={() => handleTileClick(tile)}
                    className={cn(
                      "group relative flex flex-col justify-between rounded-lg border p-3 text-left transition-all",
                      isSelected
                        ? "border-sandstone bg-sandstone/10 shadow-xs"
                        : "border-hairline bg-paper hover:border-sandstone/60 hover:bg-card",
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <span className="font-mono text-xs font-semibold text-muted">
                        {tile.suggested_dept}
                      </span>
                      {tile.red_flag_candidate && (
                        <span
                          className="size-2 rounded-full bg-brick"
                          title="Critical red flag candidate"
                        />
                      )}
                    </div>
                    <div className="mt-2">
                      <div className="text-xs font-semibold text-ink group-hover:text-sandstone">
                        {tile.en}
                      </div>
                      <div className="mt-0.5 font-deva text-xs text-muted">{tile.hi}</div>
                    </div>
                    {isSelected && (
                      <div className="absolute top-2 right-2 rounded-full bg-sandstone p-0.5 text-paper">
                        <Check className="size-3" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Free Text & Voice Box */}
            <div className="mt-5 border-t border-hairline pt-4">
              <label className="block text-xs font-medium text-ink">
                Additional Notes / Voice Input · अतिरिक्त विवरण
              </label>
              <div className="relative mt-1">
                <textarea
                  rows={2}
                  placeholder="Type symptoms or tap mic for speech (Hindi/English/Hinglish)..."
                  value={freeText}
                  onChange={(e) => setFreeText(e.target.value)}
                  className="w-full rounded-md border border-hairline bg-paper p-2.5 pr-12 text-xs text-ink placeholder:text-muted/60 focus:border-sandstone focus:outline-hidden"
                />
                <button
                  type="button"
                  onClick={handleVoiceToggle}
                  title="Speech to text"
                  className={cn(
                    "absolute right-2 top-2 rounded-md p-2 transition-colors",
                    isRecording
                      ? "animate-pulse bg-brick text-paper"
                      : "border border-hairline bg-card text-muted hover:text-ink",
                  )}
                >
                  {isRecording ? <MicOff className="size-4" /> : <Mic className="size-4" />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Live Triage Result & Submission (4 cols) */}
        <div className="space-y-6 lg:col-span-4">
          {/* Live Decision Support Card */}
          <div className="sticky top-20 rounded-xl border border-hairline bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between border-b border-hairline pb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                Decision Support · प्राथमिकता निर्णय
              </span>
              <span className="font-mono text-[11px] text-muted">Deterministic</span>
            </div>

            {/* Priority Result Banner */}
            <div className="mt-4 flex flex-col items-start gap-2">
              <LevelBadge level={triageResult.level} size="lg" bilingual />

              <div className="mt-2 rounded-lg border border-hairline bg-paper p-3 text-xs leading-relaxed">
                <div className="font-medium text-ink">{triageResult.reason_en}</div>
                <div className="mt-1 font-deva text-muted">{triageResult.reason_hi}</div>
              </div>
            </div>

            {/* Clinical Tasks */}
            {triageResult.tasks.length > 0 && (
              <div className="mt-4">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                  Required Clinical Tasks:
                </span>
                <ul className="mt-2 space-y-1.5">
                  {triageResult.tasks.map((task, idx) => (
                    <li
                      key={idx}
                      className="flex items-center gap-2 rounded-md border border-hairline bg-paper px-2.5 py-1.5 text-xs text-ink"
                    >
                      <CheckCircle2 className="size-3.5 shrink-0 text-turmeric" />
                      <span>{task}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Department Assignment */}
            <div className="mt-4 border-t border-hairline pt-4">
              <label className="block text-xs font-medium text-ink">
                Assigned Department / विभाग
              </label>
              <select
                value={effectiveDept}
                onChange={(e) => setOverrideDept(e.target.value)}
                className="mt-1 w-full rounded-md border border-hairline bg-paper px-3 py-2 text-xs font-semibold text-ink focus:border-sandstone focus:outline-hidden"
              >
                {departmentsData.departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name_en} ({d.name_hi}) [{d.id}]
                  </option>
                ))}
              </select>
            </div>

            {/* Register & Generate Token Button */}
            <button
              type="button"
              onClick={handleRegister}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-ink py-3 text-sm font-semibold text-paper shadow-xs hover:bg-ink/90 active:scale-[0.99] transition-all"
            >
              <Printer className="size-4" />
              Register & Print Token Slip
            </button>
            <p className="mt-2 text-center text-[11px] text-muted">
              Authoritative engine recalculates on server · Audit log recorded
            </p>
          </div>

          {/* Today's Recent Queue */}
          <div className="rounded-xl border border-hairline bg-card p-5 shadow-xs">
            <div className="flex items-center justify-between border-b border-hairline pb-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">
                Recent Queue Today ({visits.length})
              </h3>
              <span className="text-[11px] text-muted">Live</span>
            </div>

            <div className="mt-3 space-y-2">
              {visits.slice(0, 5).map((v) => (
                <div
                  key={v.id}
                  className="flex items-center justify-between rounded-lg border border-hairline bg-paper p-2.5 text-xs"
                >
                  <div>
                    <div className="font-mono font-bold text-ink">{v.tokenLabel}</div>
                    <div className="truncate text-muted">{v.fullName}</div>
                  </div>
                  <LevelBadge level={v.level} size="sm" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Red-Flag Follow-up Sheet Modal */}
      {activeFollowupTile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl border border-hairline bg-card p-6 shadow-xl animate-in fade-in-50 zoom-in-95">
            <div className="flex items-center justify-between border-b border-hairline pb-3">
              <div className="flex items-center gap-2">
                <AlertOctagon className="size-5 text-brick" />
                <h3 className="font-semibold text-ink">
                  Follow-up: {activeFollowupTile.en}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveFollowupTile(null)}
                className="rounded-md p-1 text-muted hover:text-ink"
              >
                <X className="size-4" />
              </button>
            </div>

            <p className="mt-3 text-xs text-muted">
              Please ask these screening questions to confirm red-flag priority:
            </p>

            <div className="mt-4 space-y-2.5">
              {activeFollowupTile.followups?.map((tagId) => {
                const tagInfo = TAGS_MAP.get(tagId);
                const isChecked = selectedTagIds.includes(tagId);
                return (
                  <button
                    key={tagId}
                    type="button"
                    onClick={() => toggleTag(tagId)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-lg border p-3 text-left transition-colors",
                      isChecked
                        ? "border-brick bg-brick/10 text-ink"
                        : "border-hairline bg-paper text-muted hover:border-sandstone",
                    )}
                  >
                    <div>
                      <div className="text-xs font-semibold text-ink">
                        {tagInfo?.en || tagId}
                      </div>
                      <div className="font-deva text-xs text-muted">
                        {tagInfo?.hi || ""}
                      </div>
                    </div>
                    <div
                      className={cn(
                        "rounded px-2.5 py-1 text-xs font-bold",
                        isChecked ? "bg-brick text-paper" : "bg-card text-muted",
                      )}
                    >
                      {isChecked ? "YES (हाँ)" : "NO (नहीं)"}
                    </div>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setActiveFollowupTile(null)}
              className="mt-6 w-full rounded-lg bg-ink py-2.5 text-xs font-semibold text-paper hover:bg-ink/90"
            >
              Done / सहेजें
            </button>
          </div>
        </div>
      )}

      {/* Printable OPD Token Thermal Slip Modal */}
      {printedVisit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-xl border border-hairline bg-card p-6 shadow-2xl">
            {/* Thermal Receipt styling */}
            <div className="rounded-lg border-2 border-dashed border-hairline bg-paper p-5 font-mono text-center text-ink shadow-inner">
              <div className="text-xs font-bold tracking-wider uppercase">
                Demo District Hospital, Jodhpur
              </div>
              <div className="text-[10px] text-muted">OPD PRIORITY TOKEN · ओ.पी.डी. पर्ची</div>
              <div className="my-2 border-b border-hairline" />

              <div className="text-3xl font-extrabold tracking-tight text-ink">
                {printedVisit.tokenLabel}
              </div>

              <div className="mt-2 flex justify-center">
                <LevelBadge level={printedVisit.level} size="md" bilingual />
              </div>

              <div className="mt-3 text-left text-xs space-y-1">
                <div>
                  <span className="text-muted">Patient:</span> <b>{printedVisit.fullName}</b>
                </div>
                <div>
                  <span className="text-muted">Age/Sex:</span> {printedVisit.ageYears}y / {printedVisit.sex}
                </div>
                <div>
                  <span className="text-muted">Dept:</span> {printedVisit.departmentId}
                </div>
                <div>
                  <span className="text-muted">Time:</span>{" "}
                  {new Date(printedVisit.registeredAt).toLocaleTimeString()}
                </div>
              </div>

              <div className="my-3 border-b border-hairline" />

              {/* QR Code Demo */}
              <div className="flex flex-col items-center justify-center gap-1">
                <div className="flex size-24 items-center justify-center rounded-md border border-hairline bg-card p-1">
                  <QrCode className="size-20 text-ink" />
                </div>
                <span className="text-[10px] text-muted">
                  Scan for live queue status: /s/{printedVisit.statusCode}
                </span>
              </div>

              <div className="mt-3 text-[10px] text-muted italic">
                Sickest first, not first come · केवल प्राथमिकता सहायता
              </div>
            </div>

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-ink py-2 text-xs font-semibold text-paper hover:bg-ink/90"
              >
                <Printer className="size-3.5" /> Print Thermal Slip
              </button>
              <button
                type="button"
                onClick={() => setPrintedVisit(null)}
                className="rounded-lg border border-hairline px-4 py-2 text-xs font-semibold text-ink hover:bg-paper"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
