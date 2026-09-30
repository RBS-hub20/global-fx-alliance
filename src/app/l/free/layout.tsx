import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Free GFXA Telegram access",
  description:
    "Gold trade ideas, market breakdowns and one serious community. Free to start — no payment details.",
  // An ad destination, not a page that should compete in search with /join.
  robots: { index: false, follow: false },
};

export default function FreeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
