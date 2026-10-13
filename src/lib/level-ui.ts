import { OctagonAlert, TriangleAlert, CircleCheck, type LucideIcon } from "lucide-react";
import type { Level } from "@/engine/levels";

/**
 * Visual tokens per level. Each level has a distinct SHAPE (octagon / triangle / circle)
 * as well as colour and label, so it reads correctly for colour-blind users and in print.
 */
export const LEVEL_UI: Record<
  Level,
  { icon: LucideIcon; text: string; soft: string; line: string; solid: string; ink: string; targetMin: number }
> = {
  IMMEDIATE: {
    icon: OctagonAlert,
    text: "text-imm",
    ink: "text-imm-ink",
    soft: "bg-imm-soft",
    line: "border-imm-line",
    solid: "bg-imm",
    targetMin: 5,
  },
  SOON: {
    icon: TriangleAlert,
    text: "text-soon",
    ink: "text-soon-ink",
    soft: "bg-soon-soft",
    line: "border-soon-line",
    solid: "bg-soon",
    targetMin: 30,
  },
  ROUTINE: {
    icon: CircleCheck,
    text: "text-rout",
    ink: "text-rout-ink",
    soft: "bg-rout-soft",
    line: "border-rout-line",
    solid: "bg-rout",
    targetMin: 120,
  },
};
