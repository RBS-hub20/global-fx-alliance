"use client";

import { readStore, writeStore } from "./storage";

/**
 * Posts the reader has shared from elsewhere in the app. Kept in local storage
 * so a shared analysis genuinely appears in the Community feed on this device
 * rather than vanishing when the tab changes — there is no backend to post to.
 */

export const SHARED_KEY = "gfxa-shared-posts";

export interface SharedPost {
  id: string;
  body: string;
  kind: "Analysis" | "Update";
  at: string;
  meta?: string;
}

export function getSharedPosts(): SharedPost[] {
  return readStore<SharedPost[]>(SHARED_KEY, []);
}

export function addSharedPost(body: string, meta?: string): SharedPost {
  const post: SharedPost = {
    id: `shared-${Date.now()}`,
    body,
    kind: "Analysis",
    at: new Date().toISOString(),
    meta,
  };
  writeStore(SHARED_KEY, [post, ...getSharedPosts()].slice(0, 20));
  return post;
}
