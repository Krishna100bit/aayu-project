import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const supabase = createAdminClient();
    const { data: usersData, error: usersError } = await supabase.auth.admin.listUsers();
    if (usersError) {
      return NextResponse.json({ error: usersError.message }, { status: 500 });
    }

    const { data: profiles, error: profError } = await supabase
      .from("profiles")
      .select("id, full_name, role, department_id");

    if (profError) {
      return NextResponse.json({ error: profError.message }, { status: 500 });
    }

    // Join auth user email with profile
    const staffList = (profiles || []).map((prof) => {
      const authUser = usersData.users.find((u) => u.id === prof.id);
      return {
        id: prof.id,
        fullName: prof.full_name,
        role: prof.role,
        departmentId: prof.department_id,
        email: authUser?.email || "",
      };
    }).filter((s) => s.email.endsWith("@triagelane.org"));

    // Deduplicate by email
    const unique = Array.from(new Map(staffList.map((s) => [s.email, s])).values());

    return NextResponse.json(unique);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to load staff list";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
