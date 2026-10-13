import { getTranslations } from "next-intl/server";
import { PhasePlaceholder } from "@/components/phase-placeholder";

export const metadata = { title: "Doctor" };

export default async function DoctorPage() {
  const t = await getTranslations("nav");
  return <PhasePlaceholder title={t("doctor")} phase={5} />;
}
