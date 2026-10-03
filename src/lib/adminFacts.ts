/**
 * Facts the running app cannot measure about itself.
 *
 * Bundle sizes come out of `next build`; nothing at request time can read them
 * on Vercel. Rather than have the console display numbers that look live, they
 * are recorded here with the date they were measured, and /admin prints that
 * date beside the deployed commit.
 *
 * Deliberately a date and not a commit: stamping the commit cannot be done
 * truthfully in the same commit that changes the sizes, and comparing SHAs
 * would flag the numbers stale after any unrelated change. A date with "re-run
 * the build" next to it is the honest version.
 *
 * Re-measure with `npm run build` and update both the sizes and MEASURED_AT.
 */

export const MEASURED_AT = "2026-10-03";

export const BUNDLES = [
  { route: "/dashboard", firstLoadKb: 310 },
  { route: "/admin", firstLoadKb: 99.1 },
  { route: "/join", firstLoadKb: 104 },
  // 94.6 before the first-party beacon was added to the shared layout.
  { route: "/l/free", firstLoadKb: 94.9 },
];

/**
 * Member-count copy, as written in the source.
 *
 * These are string literals in JSX, so there is no variable to import — the
 * file and line are recorded instead, and the console compares them with the one
 * value it *can* read live (COMMUNITY_TARGET.members) and with the real row
 * count in profiles. Three different numbers on three public pages is the
 * finding; this is how the console can state it rather than imply it.
 */
export const RECORDED_MEMBER_CLAIMS = [
  { where: "src/components/landing/Hero.tsx:9", shown: "12k+", note: 'Landing hero stat, label "Traders".' },
  { where: "src/app/join/SocialProofRow.tsx:10", shown: "5,000+", note: "Default prop, rendered on /join and /l/free." },
  { where: "src/app/join/SocialProofRow.tsx:34", shown: "5,000+", note: 'Stats row, label "traders inside".' },
];
