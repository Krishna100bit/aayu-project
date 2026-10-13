import { getTranslations } from "next-intl/server";
import { PhasePlaceholder } from "@/components/phase-placeholder";

export const metadata = { title: "Admin" };

export default async function AdminPage() {
  const t = await getTranslations("nav");
  return <PhasePlaceholder title={t("admin")} phase={8} />;
}
