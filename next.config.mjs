/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  /**
   * Serves the join landing page at the bare root of its own subdomain, so the
   * link in a TikTok or Instagram bio is `join.globalfxalliance.io` with no path.
   *
   * The `has` host condition is what keeps this safe: the rule only matches when
   * the request's Host header is the join subdomain, so `globalfxalliance.io/`
   * still renders the main landing page and every other path on both hosts is
   * untouched. A rewrite rather than a redirect, so the clean URL stays in the
   * address bar.
   *
   * `/join` continues to work on both hosts.
   *
   * `beforeFiles` matters here. Returning a plain array puts a rewrite in
   * `afterFiles`, which is only consulted once the filesystem has failed to
   * match — and `/` is a statically generated page, so it always matches first
   * and the rewrite never runs. Measured: with the array form, the join host and
   * the main host returned byte-identical HTML.
   */
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/",
          has: [{ type: "host", value: "join.globalfxalliance.io" }],
          destination: "/join",
        },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;
