import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard",
  description:
    "Global market pulse, market intelligence, AI assistance, trading tools and the Alliance community.",
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return children;
}
