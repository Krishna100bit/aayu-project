"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LogIn, LogOut, User } from "lucide-react";

export function AuthHeaderButton() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    async function loadUser() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setUserEmail(user.email || null);
          const { data: profile } = await supabase
            .from("profiles")
            .select("role, full_name")
            .eq("id", user.id)
            .single();
          setRole(profile?.role || user.user_metadata?.role || "staff");
        } else {
          setUserEmail(null);
          setRole(null);
        }
      } catch {
        setUserEmail(null);
      } finally {
        setLoading(false);
      }
    }

    loadUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUserEmail(session.user.email || null);
        setRole(session.user.user_metadata?.role || "staff");
      } else {
        setUserEmail(null);
        setRole(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUserEmail(null);
    setRole(null);
    router.push("/login");
    router.refresh();
  };

  if (loading) {
    return <div className="h-8 w-20 animate-pulse rounded bg-sand-soft/50" />;
  }

  if (!userEmail) {
    return (
      <Link
        href="/login"
        className="flex items-center gap-1.5 rounded-lg border border-hairline bg-white px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:border-sand hover:bg-sand-soft/40"
      >
        <LogIn className="size-3.5 text-sand-dark" />
        Staff Login
      </Link>
    );
  }

  const roleLabels: Record<string, string> = {
    receptionist: "Reception",
    nurse: "Nurse",
    doctor: "Doctor",
    admin: "Admin",
  };

  return (
    <div className="flex items-center gap-2">
      <div className="hidden sm:flex items-center gap-1.5 rounded-lg border border-hairline bg-white px-2.5 py-1 text-xs text-ink">
        <User className="size-3 text-muted" />
        <span className="font-semibold capitalize text-[#7a4424]">
          {roleLabels[role || ""] || role || "Staff"}
        </span>
      </div>
      <button
        onClick={handleSignOut}
        title={`Sign out (${userEmail})`}
        className="flex items-center gap-1 rounded-lg border border-hairline bg-white px-2.5 py-1.5 text-xs font-medium text-muted transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-700"
      >
        <LogOut className="size-3.5" />
        <span className="hidden sm:inline">Sign Out</span>
      </button>
    </div>
  );
}
