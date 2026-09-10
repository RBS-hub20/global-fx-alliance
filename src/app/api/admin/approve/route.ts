import { review } from "@/lib/adminReview";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return review(request, "approved");
}
