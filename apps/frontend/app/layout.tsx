import type { Metadata } from "next";
import { IBM_Plex_Mono, Inter } from "next/font/google";

import { Navigation } from "@/components/navigation";
import { ServiceAvailabilityBanner } from "@/components/service-availability-banner";
import { LocalizedDocumentTitle } from "@/components/localized-document-title";
import { Mt5StatusProvider } from "@/hooks/use-mt5-status";
import { I18nProvider } from "@/lib/i18n";

import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], variable: "--font-mono", weight: ["400", "500"] });

export const metadata: Metadata = {
  title: { default: "MonteCarlo Trading Intelligence", template: "%s | MonteCarlo" },
  description: "A focused workspace for market data and trade analytics.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>): React.JSX.Element {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable}`}>
      <body>
        <I18nProvider>
          <LocalizedDocumentTitle />
          <Mt5StatusProvider>
            <div className="app-shell">
              <Navigation />
              <main className="main-content">
                <ServiceAvailabilityBanner />
                {children}
              </main>
            </div>
          </Mt5StatusProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
