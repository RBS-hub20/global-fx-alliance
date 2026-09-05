export { GET, POST, runtime } from "../shoutbox/route";

/**
 * Alias for `/api/shoutbox`, which is what the channel was called before it
 * became GFXA Chat. Both paths stay live so a client that has not reloaded
 * keeps working through a deploy.
 */
