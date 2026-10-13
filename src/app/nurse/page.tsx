import { getTranslations } from "next-intl/server";
import { PhasePlaceholder } from "@/components/phase-placeholder";

export const metadata = { title: "Nurse" };

export default async function NursePage() {
  const t = await getTranslations("nav");
  return <PhasePlaceholder title={t("nurse")} phase={4} />;
}
