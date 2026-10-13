import { getTranslations } from "next-intl/server";
import { ShieldCheck } from "lucide-react";

/** Required safety disclaimer (docs/SAFETY_PRIVACY_TESTING.md §1), visible on every page. */
export async function AppFooter() {
  const t = await getTranslations();
  return (
    <footer className="mt-auto border-t border-hairline">
      <div className="mx-auto flex max-w-[1440px] items-start gap-3 px-4 py-4 sm:px-6">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden />
        <p id="disclaimer" className="max-w-4xl text-xs leading-relaxed text-muted">
          {t("disclaimer")}
        </p>
      </div>
    </footer>
  );
}
