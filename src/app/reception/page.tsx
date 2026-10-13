import { getTranslations } from "next-intl/server";
import { PhasePlaceholder } from "@/components/phase-placeholder";

export const metadata = { title: "Reception" };

export default async function ReceptionPage() {
  const t = await getTranslations("nav");
  return <PhasePlaceholder title={t("reception")} phase={3} />;
}
