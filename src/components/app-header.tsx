import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Wordmark } from "./wordmark";
import { ContrastToggle } from "./contrast-toggle";
import { AuthHeaderButton } from "./auth-header-button";

export async function AppHeader() {
  const t = await getTranslations("app");
  return (
    <header className="sticky top-0 z-30 border-b border-hairline bg-paper/95 backdrop-blur-[2px]">
      <div className="mx-auto flex h-14 max-w-[1440px] items-center gap-4 px-4 sm:px-6">
        <Link href="/" id="home-link" className="shrink-0" aria-label="TriageLane home">
          <Wordmark />
        </Link>
        <span className="hidden h-5 w-px bg-hairline lg:block" aria-hidden />
        <span className="hidden truncate text-sm text-muted lg:block">{t("hospital")}</span>
        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <ContrastToggle />
          <AuthHeaderButton />
        </div>
      </div>
    </header>
  );
}
