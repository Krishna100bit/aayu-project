import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowUpRight, ClipboardList, Stethoscope, Activity, Settings2, MonitorPlay } from "lucide-react";
import { LEVELS } from "@/engine/levels";
import { LevelBadge } from "@/components/level-badge";
import { LEVEL_UI } from "@/lib/level-ui";

const ROLES = [
  { key: "reception", href: "/reception", icon: ClipboardList },
  { key: "nurse", href: "/nurse", icon: Activity },
  { key: "doctor", href: "/doctor", icon: Stethoscope },
  { key: "admin", href: "/admin", icon: Settings2 },
  { key: "display", href: "/display/GEN_MED", icon: MonitorPlay },
] as const;

export default async function HomePage() {
  const t = await getTranslations();

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6 lg:py-16">
      <section className="grid gap-10 lg:grid-cols-[1.25fr_1fr] lg:gap-16">
        <div>
          <p className="eyebrow">OPD · T05 / opd-flow</p>
          <h1 className="mt-3 max-w-[18ch] text-[2.5rem] leading-[1.05] font-semibold text-ink sm:text-[3.25rem]">
            {t("app.tagline")}
          </h1>
          <p className="mt-5 max-w-[60ch] text-[1.0625rem] leading-relaxed text-ink-2">{t("home.intro")}</p>
        </div>

        <aside className="self-end rounded-lg border border-hairline bg-card">
          <p className="eyebrow border-b border-hairline px-5 py-3">{t("home.levelsTitle")}</p>
          <ul className="divide-y divide-hairline">
            {LEVELS.map((level) => (
              <li key={level} className="flex items-center gap-4 px-5 py-4">
                <LevelBadge level={level} bilingual className="w-[11.5rem] shrink-0" />
                <span className="flex-1 text-sm text-ink-2">{t(`levels.${level}_desc`)}</span>
                <span className="font-mono text-xs text-muted tabular">
                  ≤ {t("home.minutes", { n: LEVEL_UI[level].targetMin })}
                </span>
              </li>
            ))}
          </ul>
        </aside>
      </section>

      <section className="mt-14">
        <h2 className="text-sm font-medium text-muted">{t("home.title")}</h2>
        <ul className="mt-4 grid gap-px overflow-hidden rounded-lg border border-hairline bg-hairline sm:grid-cols-2 lg:grid-cols-5">
          {ROLES.map(({ key, href, icon: Icon }, i) => (
            <li key={key} className="bg-card">
              <Link
                id={`role-${key}`}
                href={href}
                className="group flex h-full min-h-44 flex-col p-5 transition-colors hover:bg-paper"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-faint tabular">0{i + 1}</span>
                  <ArrowUpRight
                    className="size-4 text-faint transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-ink"
                    aria-hidden
                  />
                </div>
                <Icon className="mt-6 size-6 text-ink" strokeWidth={1.75} aria-hidden />
                <span className="mt-3 text-lg font-semibold text-ink">{t(`nav.${key}`)}</span>
                <span className="mt-1 text-sm leading-snug text-muted">{t(`home.roles.${key}`)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
