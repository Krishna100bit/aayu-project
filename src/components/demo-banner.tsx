import { getTranslations } from "next-intl/server";
import { serverEnv } from "@/lib/env";

export async function DemoBanner() {
  if (!serverEnv().DEMO_MODE) return null;
  const t = await getTranslations("common");
  return (
    <div className="border-b border-sand/30 bg-sand-soft">
      <p className="mx-auto max-w-[1440px] px-4 py-1 text-center text-[0.75rem] font-medium tracking-wide text-[#7a4424] sm:px-6">
        {t("demoBanner")}
      </p>
    </div>
  );
}
