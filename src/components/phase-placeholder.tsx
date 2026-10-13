import { getTranslations } from "next-intl/server";

export async function PhasePlaceholder({ title, phase, children }: { title: string; phase: number; children?: React.ReactNode }) {
  const t = await getTranslations("common");
  return (
    <div className="mx-auto max-w-[1440px] px-4 py-12 sm:px-6">
      <p className="eyebrow">Phase {phase}</p>
      <h1 className="mt-2 text-3xl font-semibold text-ink">{title}</h1>
      <div className="mt-6 rounded-lg border border-dashed border-hairline-strong bg-card/60 px-6 py-10 text-muted">
        <p>{t("comingSoon")}</p>
        {children}
      </div>
    </div>
  );
}
