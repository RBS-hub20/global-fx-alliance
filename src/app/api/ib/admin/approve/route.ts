import { reviewFrom } from "@/lib/ibReview";

export const runtime = "nodejs";

/** Thin alias for `POST /api/ib/admin` with action "approve". */
export async function POST(request: Request) {
  return reviewFrom(request, "approve");
}
