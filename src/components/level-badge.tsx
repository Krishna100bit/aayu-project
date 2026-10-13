import { useTranslations } from "next-intl";
import type { Level } from "@/engine/levels";
import { LEVEL_UI } from "@/lib/level-ui";
import { cn } from "@/lib/utils";

type Size = "sm" | "md" | "lg";

const sizes: Record<Size, { box: string; icon: string; text: string }> = {
  sm: { box: "h-7 gap-1.5 px-2", icon: "size-3.5", text: "text-xs font-semibold tracking-wide" },
  md: { box: "h-9 gap-2 px-3", icon: "size-4", text: "text-sm font-semibold tracking-wide" },
  lg: { box: "h-14 gap-3 px-4", icon: "size-6", text: "text-xl font-semibold tracking-tight" },
};

/** Level chip: icon + label + colour, always together (UX rule: never colour alone). */
export function LevelBadge({
  level,
  size = "md",
  bilingual = false,
  className,
}: {
  level: Level;
  size?: Size;
  bilingual?: boolean;
  className?: string;
}) {
  const t = useTranslations("levels");
  const ui = LEVEL_UI[level];
  const Icon = ui.icon;
  const s = sizes[size];
  const en = level.charAt(0) + level.slice(1).toLowerCase();

  return (
    <span
      className={cn("inline-flex items-center rounded-md border", ui.soft, ui.line, ui.ink, s.box, className)}
      data-level={level}
    >
      <Icon className={cn(s.icon, ui.text)} strokeWidth={2.25} aria-hidden />
      <span className={cn(s.text, "uppercase")}>
        {bilingual ? (
          <>
            {en} <span className="font-normal opacity-60">·</span> <span className="font-deva normal-case">{t(level)}</span>
          </>
        ) : (
          t(level)
        )}
      </span>
    </span>
  );
}
