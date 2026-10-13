"use client";

import { useTransition } from "react";
import { useLocale } from "next-intl";
import { setLocale } from "@/i18n/actions";
import { cn } from "@/lib/utils";

/** One-tap हिं / EN toggle (NFR: language toggle in one tap). */
export function LanguageToggle() {
  const locale = useLocale();
  const [pending, start] = useTransition();

  const opt = (value: "hi" | "en", label: string) => (
    <button
      type="button"
      onClick={() => start(() => setLocale(value))}
      aria-pressed={locale === value}
      className={cn(
        "h-8 min-w-10 rounded-[5px] px-2 text-sm transition-colors",
        locale === value ? "bg-ink text-paper" : "text-muted hover:text-ink",
        value === "hi" && "font-deva",
      )}
    >
      {label}
    </button>
  );

  return (
    <div
      id="language-toggle"
      role="group"
      aria-label="Language / भाषा"
      className={cn("inline-flex items-center gap-0.5 rounded-md border border-hairline bg-card p-0.5", pending && "opacity-60")}
    >
      {opt("hi", "हिं")}
      {opt("en", "EN")}
    </div>
  );
}
