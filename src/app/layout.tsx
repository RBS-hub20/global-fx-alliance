import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { LogoDefs } from "@/components/brand/LogoMark";
import { AiMarkDefs } from "@/components/brand/AiMark";
import { COPY } from "@/lib/launch";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const SITE = "https://globalfxalliance.io";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: {
    default: "Global FX Alliance — The Global Community for Forex Traders",
    template: "%s | Global FX Alliance",
  },
  description: COPY.seoDescription,
  keywords: [
    "forex community",
    "forex traders",
    "XAUUSD analysis",
    "forex AI",
    "trading terminal",
    "forex education",
    "market intelligence",
    "global fx alliance",
  ],
  authors: [{ name: "Global FX Alliance", url: SITE }],
  creator: "Global FX Alliance",
  publisher: "Global FX Alliance",
  applicationName: "Global FX Alliance",
  category: "finance",
  alternates: { canonical: SITE },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE,
    siteName: "Global FX Alliance",
    title: "Global FX Alliance — The Global Community for Forex Traders",
    description: `Bloomberg-style AI terminal + TradingView-grade auto-drawn charts. ${COPY.ogSubtitle}. Educational only.`,
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Global FX Alliance — AI terminal and pro auto-drawn charts",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@gfxa",
    creator: "@gfxa",
    title: "Global FX Alliance — The Global Community for Forex Traders",
    description: "Bloomberg-style AI terminal + pro auto-drawn charts. Educational only.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }, { url: "/logo.png", sizes: "1024x1024" }],
    apple: [{ url: "/logo.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#070A12",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <LogoDefs />
        <AiMarkDefs />
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
