import { z } from "zod";

/**
 * Single source of truth for environment variables (engineering rule: read env only via this file).
 * Supabase keys are optional until Phase 2 so the UI can run without a database;
 * code that needs them must call `requireSupabase()` / `requireServiceRole()`.
 */

const emptyToUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
const optionalStr = z.preprocess(emptyToUndefined, z.string().optional());
const optionalUrl = z.preprocess(emptyToUndefined, z.string().url().optional());

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: optionalUrl,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: optionalStr,
  NEXT_PUBLIC_APP_URL: z.preprocess(emptyToUndefined, z.string().url().default("http://localhost:3000")),
});

const serverSchema = publicSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: optionalStr,
  STATUS_PAGE_BASE_URL: z.preprocess(emptyToUndefined, z.string().url().default("http://localhost:3000/s")),
  HOSPITAL_NAME: z.preprocess(emptyToUndefined, z.string().default("Demo District Hospital, Jodhpur")),
  N8N_WEBHOOK_URL: optionalUrl,
  N8N_SHARED_SECRET: optionalStr,
  LLM_PROVIDER: z.preprocess(emptyToUndefined, z.enum(["anthropic", "ollama", "none"]).default("none")),
  ANTHROPIC_API_KEY: optionalStr,
  ANTHROPIC_MODEL: z.preprocess(emptyToUndefined, z.string().default("claude-haiku-5-5")),
  OLLAMA_BASE_URL: z.preprocess(emptyToUndefined, z.string().url().default("http://localhost:11434")),
  OLLAMA_MODEL: z.preprocess(emptyToUndefined, z.string().default("qwen2.5:3b")),
  TELEGRAM_BOT_TOKEN: optionalStr,
  WHATSAPP_CLOUD_TOKEN: optionalStr,
  WHATSAPP_PHONE_NUMBER_ID: optionalStr,
  SMS_PROVIDER_KEY: optionalStr,
  DEMO_MODE: z.preprocess(emptyToUndefined, z.enum(["true", "false"]).default("true")).transform((v) => v === "true"),
});

export type PublicEnv = z.infer<typeof publicSchema>;
export type ServerEnv = z.infer<typeof serverSchema>;

function format(err: z.ZodError): string {
  return err.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
}

/** Safe in the browser: Next inlines NEXT_PUBLIC_* only when referenced literally. */
export const publicEnv: PublicEnv = (() => {
  const parsed = publicSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  });
  if (!parsed.success) throw new Error(`Invalid public environment:\n${format(parsed.error)}`);
  return parsed.data;
})();

let cachedServerEnv: ServerEnv | undefined;

/** Server only. Never import the result into client components. */
export function serverEnv(): ServerEnv {
  if (typeof window !== "undefined") throw new Error("serverEnv() must not be called in the browser");
  if (cachedServerEnv) return cachedServerEnv;
  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) throw new Error(`Invalid server environment:\n${format(parsed.error)}`);
  cachedServerEnv = parsed.data;
  return cachedServerEnv;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(publicEnv.NEXT_PUBLIC_SUPABASE_URL && publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function requireSupabase(): { url: string; anonKey: string } {
  const url = publicEnv.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("Supabase is not configured. Fill NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local");
  }
  return { url, anonKey };
}

export function requireServiceRole(): string {
  const key = serverEnv().SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set (server only).");
  return key;
}
