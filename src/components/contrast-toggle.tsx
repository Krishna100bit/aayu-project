"use client";

import { useEffect, useState } from "react";
import { Contrast } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

const KEY = "tl_contrast";

/** Toggles <html data-contrast="high">; persisted per device. */
export function ContrastToggle() {
  const t = useTranslations("common");
  const [high, setHigh] = useState(false);

  useEffect(() => {
    setHigh(localStorage.getItem(KEY) === "high");
  }, []);

  useEffect(() => {
    document.documentElement.dataset.contrast = high ? "high" : "normal";
  }, [high]);

  return (
    <button
      id="contrast-toggle"
      type="button"
      aria-pressed={high}
      title={t("highContrast")}
      aria-label={t("highContrast")}
      onClick={() => {
        const next = !high;
        setHigh(next);
        localStorage.setItem(KEY, next ? "high" : "normal");
      }}
      className={cn(
        "grid size-9 place-items-center rounded-md border border-hairline bg-card text-muted transition-colors hover:text-ink",
        high && "border-ink text-ink",
      )}
    >
      <Contrast className="size-4" aria-hidden />
    </button>
  );
}
