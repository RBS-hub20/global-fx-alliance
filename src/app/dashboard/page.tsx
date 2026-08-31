import { Suspense } from "react";
import { DashboardApp } from "@/components/dashboard/DashboardApp";
import { Skeleton } from "@/components/ui/Primitives";

/** useSearchParams needs a Suspense boundary for the route to prerender. */
function Booting() {
  return (
    <div className="flex min-h-screen">
      <div className="hidden w-[280px] shrink-0 border-r border-white/[0.08] bg-[#080C18] lg:block" />
      <div className="flex-1 space-y-5 px-5 pt-24 lg:px-8">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<Booting />}>
      <DashboardApp />
    </Suspense>
  );
}
