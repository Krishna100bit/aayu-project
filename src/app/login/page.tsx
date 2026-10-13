"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Shield, KeyRound, UserCheck, Stethoscope, Activity, ClipboardList, AlertCircle, ArrowRight } from "lucide-react";

const STAFF_STATIONS = [
  {
    role: "receptionist",
    label: "Reception Desk",
    staffName: "Anita Sharma",
    email: "anita@triagelane.org",
    target: "/reception",
    icon: ClipboardList,
    description: "Patient intake, bilingual symptom selection, and token slip printing",
  },
  {
    role: "nurse",
    label: "Triage Nurse Station",
    staffName: "Sunita Bishnoi",
    email: "sunita@triagelane.org",
    target: "/nurse",
    icon: Activity,
    description: "3 live priority lanes, vital signs entry, and clinical overrides",
  },
  {
    role: "doctor",
    label: "OPD Doctor Bay",
    staffName: "Dr. Arvind Gehlot",
    email: "arvind@triagelane.org",
    target: "/doctor",
    icon: Stethoscope,
    description: "Consultation bay, active queue calling, and patient discharge",
  },
  {
    role: "admin",
    label: "Clinical Administrator",
    staffName: "System Admin",
    email: "admin@triagelane.org",
    target: "/admin",
    icon: Shield,
    description: "Triage rules inspector, escalation thresholds, and audit trail",
  },
];

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextUrl = searchParams.get("next");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const supabase = createClient();
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password,
      });

      if (authError || !data.user) {
        setError(authError?.message || "Invalid credentials. Please verify your email and password.");
        setLoading(false);
        return;
      }

      // Query user role from profiles
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .single();

      const userRole = profile?.role || data.user.user_metadata?.role;

      let destination = nextUrl;
      if (!destination) {
        if (userRole === "nurse") destination = "/nurse";
        else if (userRole === "doctor") destination = "/doctor";
        else if (userRole === "admin") destination = "/admin";
        else if (userRole === "receptionist") destination = "/reception";
        else destination = "/reception";
      }

      router.push(destination);
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Authentication failed";
      setError(msg);
      setLoading(false);
    }
  };

  const selectStation = (staffEmail: string) => {
    setEmail(staffEmail);
    const pwdInput = document.getElementById("password-input") as HTMLInputElement;
    if (pwdInput) pwdInput.focus();
  };

  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl flex-col justify-center px-4 py-8 sm:px-6">
      <div className="grid gap-8 lg:grid-cols-12 lg:items-start">
        {/* Left Column: Staff Sign In Form */}
        <div className="lg:col-span-6">
          <div className="rounded-xl border border-hairline bg-paper p-6 shadow-xs sm:p-8">
            <div className="mb-6 flex items-center gap-3 border-b border-hairline pb-4">
              <div className="flex size-10 items-center justify-center rounded-lg bg-sand/20 text-sand-dark">
                <Shield className="size-5" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-ink">Hospital Staff Sign In</h1>
                <p className="text-xs text-muted">Authorized clinical personnel access only</p>
              </div>
            </div>

            {error && (
              <div className="mb-5 flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50/60 p-3.5 text-xs text-red-700">
                <AlertCircle className="mt-0.5 size-4 shrink-0 text-red-600" />
                <p className="leading-relaxed">{error}</p>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted">
                  Hospital Email (@triagelane.org)
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@triagelane.org"
                  className="w-full rounded-lg border border-hairline bg-white px-3.5 py-2.5 text-sm text-ink placeholder:text-muted/60 focus:border-sand focus:outline-none focus:ring-1 focus:ring-sand"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password-input"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter account password"
                    className="w-full rounded-lg border border-hairline bg-white px-3.5 py-2.5 text-sm text-ink placeholder:text-muted/60 focus:border-sand focus:outline-none focus:ring-1 focus:ring-sand"
                  />
                  <KeyRound className="pointer-events-none absolute right-3.5 top-3 size-4 text-muted/60" />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-ink px-4 py-2.5 text-sm font-semibold text-paper transition-all hover:bg-ink/90 disabled:opacity-60"
              >
                {loading ? "Authenticating..." : "Sign In to Station"}
                <ArrowRight className="size-4" />
              </button>
            </form>

            <div className="mt-6 rounded-lg border border-hairline bg-sand-soft/50 p-3.5 text-[0.8rem] text-muted">
              <p className="flex items-center gap-1.5 font-medium text-ink">
                <UserCheck className="size-4 text-sand-dark" />
                Secure Clinical Role Guards
              </p>
              <p className="mt-1 leading-relaxed">
                Protected by Supabase Auth and server middleware. Access permissions are strictly partitioned by clinical role.
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: Hospital Staff Directory */}
        <div className="lg:col-span-6">
          <div className="rounded-xl border border-hairline bg-paper/60 p-6 sm:p-8">
            <div className="mb-4">
              <h2 className="text-base font-bold text-ink">Hospital Station Directory</h2>
              <p className="text-xs text-muted">
                Official staff accounts assigned to clinical units. Click any station to pre-fill its email.
              </p>
            </div>

            <div className="grid gap-3">
              {STAFF_STATIONS.map((station) => {
                const Icon = station.icon;
                const isSelected = email === station.email;
                return (
                  <button
                    key={station.role}
                    type="button"
                    onClick={() => selectStation(station.email)}
                    className={`group flex items-start gap-3.5 rounded-lg border p-3.5 text-left transition-all ${
                      isSelected
                        ? "border-sand bg-sand-soft/50 shadow-xs"
                        : "border-hairline bg-white hover:border-sand hover:bg-sand-soft/30"
                    }`}
                  >
                    <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md border border-hairline bg-sand-soft text-sand-dark group-hover:border-sand">
                      <Icon className="size-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-sm text-ink group-hover:text-sand-dark">
                          {station.label}
                        </span>
                        <span className="rounded bg-sand/15 px-1.5 py-0.5 text-[0.7rem] font-medium text-[#7a4424]">
                          {station.staffName}
                        </span>
                      </div>
                      <p className="text-xs text-muted mt-0.5">{station.description}</p>
                      <p className="text-[0.75rem] text-ink/80 mt-1 font-mono font-medium">
                        {station.email}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
