import type { Metadata } from "next";
import { IndicatorDetail } from "@/components/dashboard/indicators/IndicatorDetail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Indicator",
  // Members-only material behind the dashboard gate; nothing to index.
  robots: { index: false, follow: false },
};

/**
 * One indicator, in detail.
 *
 * A real route rather than another `?tab=` panel: it is per-indicator and worth
 * linking to directly, and /dashboard/:path* is already covered by the
 * middleware so a signed-out visitor gets the login form.
 */
export default function IndicatorPage({ params }: { params: { slug: string } }) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <IndicatorDetail slug={params.slug} />
    </div>
  );
}
