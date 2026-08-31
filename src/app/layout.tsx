import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { LogoDefs } from "@/components/brand/LogoMark";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const SITE = "https://globalfxalliance.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: {
    default: "GLOBAL FX ALLIANCE — The Global Community for Forex Traders",
    template: "%s | GLOBAL FX ALLIANCE",
  },
  description:
    "Join a growing global network of Forex traders, analysts, educators and market enthusiasts. Learn, connect, share insights and grow together.",
  keywords: [
    "forex community",
    "global fx alliance",
    "trading education",
    "market intelligence",
    "forex traders network",
  ],
  openGraph: {
    title: "GLOBAL FX ALLIANCE — The Global Community for Forex Traders",
    description:
      "Connect. Learn. Analyze. Grow. A global trading intelligence network for Forex traders.",
    url: SITE,
    siteName: "GLOBAL FX ALLIANCE",
    images: [{ url: "/logo.png", width: 1024, height: 1024, alt: "GLOBAL FX ALLIANCE" }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "GLOBAL FX ALLIANCE",
    description: "The Global Community for Forex Traders.",
    images: ["/logo.png"],
  },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }, { url: "/logo.png", sizes: "1024x1024" }],
    apple: "/logo.png",
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
        {children}
      </body>
    </html>
  );
}
