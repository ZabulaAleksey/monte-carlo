import type { Metadata } from "next";
import { IBM_Plex_Mono, Inter } from "next/font/google";

import { Navigation } from "@/components/navigation";

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
        <div className="app-shell">
          <Navigation />
          <main className="main-content">{children}</main>
        </div>
      </body>
    </html>
  );
}
