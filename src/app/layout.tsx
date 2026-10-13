import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, IBM_Plex_Sans_Devanagari } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { AppHeader } from "@/components/app-header";
import { AppFooter } from "@/components/app-footer";
import { DemoBanner } from "@/components/demo-banner";
import "./globals.css";

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-sans",
  display: "swap",
});
const plexDeva = IBM_Plex_Sans_Devanagari({
  subsets: ["devanagari", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-deva",
  display: "swap",
});
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "TriageLane · OPD priority queue", template: "%s · TriageLane" },
  description:
    "Sickest first, not first come. A safe, explainable, auditable patient-priority queue for government hospital OPDs. Decision support only; not a diagnosis.",
  applicationName: "TriageLane",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#f6f3ec",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html
      lang={locale}
      data-contrast="normal"
      className={`${plexSans.variable} ${plexDeva.variable} ${plexMono.variable}`}
      suppressHydrationWarning
    >
      <body className="flex min-h-dvh flex-col">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <DemoBanner />
          <AppHeader />
          <main className="flex-1">{children}</main>
          <AppFooter />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
