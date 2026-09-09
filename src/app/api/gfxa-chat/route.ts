import { GET as chatGet, POST as chatPost } from "../shoutbox/route";

/**
 * Alias for `/api/shoutbox`, which is what the channel was called before it
 * became GFXA Chat. Both paths stay live so a client that has not reloaded
 * keeps working through a deploy.
 *
 * `runtime` is declared here as a literal rather than re-exported from the
 * shoutbox route: Next reads this field by static analysis at build time, and a
 * re-export is not something it can follow — it warned and silently fell back to
 * the default runtime instead of honouring the one the handlers expect.
 */
export const runtime = "nodejs";

export async function GET() {
  return chatGet();
}

export async function POST(request: Request) {
  return chatPost(request);
}
