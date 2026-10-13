import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const staffPassword = process.env.STAFF_PASSWORD;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
}

if (!staffPassword) {
  throw new Error("STAFF_PASSWORD must be configured in environment variables (.env.local).");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const staffUsers = [
  {
    email: "anita@triagelane.org",
    full_name: "Anita Sharma (Reception Desk)",
    role: "receptionist",
    department_id: "GEN_MED",
  },
  {
    email: "sunita@triagelane.org",
    full_name: "Staff Nurse Sunita Bishnoi",
    role: "nurse",
    department_id: "GEN_MED",
  },
  {
    email: "arvind@triagelane.org",
    full_name: "Dr. Arvind Gehlot (MD Med)",
    role: "doctor",
    department_id: "GEN_MED",
  },
  {
    email: "admin@triagelane.org",
    full_name: "Hospital Clinical Administrator",
    role: "admin",
    department_id: "GEN_MED",
  },
];

async function seedUsers() {
  console.log("🔐 Provisioning official staff accounts (@triagelane.org)...");

  for (const staff of staffUsers) {
    const { data: listData } = await supabase.auth.admin.listUsers();
    const existing = listData?.users?.find((u) => u.email === staff.email);

    let userId: string;
    if (existing) {
      console.log(`Updating password for ${staff.email}...`);
      userId = existing.id;
      await supabase.auth.admin.updateUserById(userId, {
        password: staffPassword,
        email_confirm: true,
        user_metadata: { full_name: staff.full_name, role: staff.role },
      });
    } else {
      console.log(`Creating user ${staff.email}...`);
      const { data: created, error } = await supabase.auth.admin.createUser({
        email: staff.email,
        password: staffPassword,
        email_confirm: true,
        user_metadata: { full_name: staff.full_name, role: staff.role },
      });
      if (error || !created.user) {
        console.error(`Failed to create ${staff.email}:`, error);
        continue;
      }
      userId = created.user.id;
    }

    // Upsert profile
    const { error: profileError } = await supabase.from("profiles").upsert({
      id: userId,
      full_name: staff.full_name,
      role: staff.role,
      department_id: staff.department_id,
      language: "en",
    });

    if (profileError) {
      console.error(`Profile error for ${staff.email}:`, profileError);
    } else {
      console.log(`✓ Profile linked for ${staff.full_name} [${staff.role}] -> ${staff.email}`);
    }
  }

  console.log("🎉 All staff accounts securely seeded with organization credentials!");
}

seedUsers();
