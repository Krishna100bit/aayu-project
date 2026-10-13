"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Shield, KeyRound, AlertCircle, ArrowRight } from "lucide-react";

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

  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col justify-center px-4 py-12 sm:px-6">
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
              Hospital Email
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
      </div>
    </div>
  );
}
