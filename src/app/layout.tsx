import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { LogoDefs } from "@/components/brand/LogoMark";
import { ServiceWorker } from "@/components/pwa/ServiceWorker";
import { AuthProvider } from "@/lib/AuthContext";
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
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    // iOS ignores the manifest for the home-screen icon and reads this instead.
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "GFXA",
    // Lets the dark app surface run under the status bar rather than leaving a
    // white strip above it.
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  /*
   * The page background, not an accent. The brief asked for #00d4ff, but this is
   * the colour iOS and Android paint the status bar and task switcher with — an
   * accent there frames a dark app in bright cyan. The locked accent is
   * #2A7FFF and it stays on the interface where it belongs.
   */
  themeColor: "#070A12",
  colorScheme: "dark",
  // Respects the notch so `black-translucent` does not hide content behind it.
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <ServiceWorker />
        <LogoDefs />
        <AiMarkDefs />
        <AuthProvider>{children}</AuthProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
