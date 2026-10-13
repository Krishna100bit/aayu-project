"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

/**
 * Role navigation placeholder. In Phase 2 this is filtered by the signed-in user's role
 * (receptionist -> /reception, nurse -> /nurse, ...) and enforced by middleware.
 */
const ITEMS = [
  { href: "/reception", key: "reception" },
  { href: "/nurse", key: "nurse" },
  { href: "/doctor", key: "doctor" },
  { href: "/admin", key: "admin" },
  { href: "/display/GEN_MED", key: "display" },
] as const;

export function RoleNav() {
  const t = useTranslations("nav");
  const pathname = usePathname();

  return (
    <nav aria-label="Workspaces" className="hidden items-center gap-1 md:flex">
      {ITEMS.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href.split("/").slice(0, 2).join("/") + "/");
        return (
          <Link
            key={item.href}
            id={`nav-${item.key}`}
            href={item.href}
            className={cn(
              "relative rounded-md px-3 py-1.5 text-sm transition-colors",
              active ? "text-ink" : "text-muted hover:text-ink",
            )}
          >
            {t(item.key)}
            {active && <span className="absolute inset-x-3 -bottom-[13px] h-[2px] bg-ink" aria-hidden />}
          </Link>
        );
      })}
    </nav>
  );
}
