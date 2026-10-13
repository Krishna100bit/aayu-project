import { getTranslations } from "next-intl/server";
import { PhasePlaceholder } from "@/components/phase-placeholder";

export const metadata = { title: "Waiting hall" };

export default async function DisplayPage({ params }: { params: Promise<{ dept: string }> }) {
  const { dept } = await params;
  const t = await getTranslations("nav");
  return (
    <PhasePlaceholder title={`${t("display")} · ${dept}`} phase={6} />
  );
}
