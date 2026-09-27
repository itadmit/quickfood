import type { Post } from "./types";
import { aggregatorCommissions } from "./posts/aggregator-commissions";
import { moveRegularsToDirect } from "./posts/move-regulars-to-direct";
import { menuThatSells } from "./posts/menu-that-sells";

export type { Post, Block } from "./types";

/**
 * Every published post. Newest first - the listing and the sitemap both read
 * this order, so adding a post is a one-line change here.
 */
export const POSTS: Post[] = [
  aggregatorCommissions,
  moveRegularsToDirect,
  menuThatSells,
];

export function getPost(slug: string): Post | undefined {
  return POSTS.find((p) => p.slug === slug);
}

/** ISO date the post was last touched - what the sitemap reports. */
export function postModified(post: Post): string {
  return post.updated ?? post.published;
}

/**
 * Rough Hebrew reading time. ~200 words/min is the usual English figure;
 * Hebrew runs denser per word, so 180 is closer for this kind of prose.
 */
export function readingMinutes(post: Post): number {
  const words = post.body
    .flatMap((b) => {
      switch (b.t) {
        case "ul":
        case "ol":
          return b.items;
        case "table":
          return [b.head.join(" "), ...b.rows.map((r) => r.join(" "))];
        case "callout":
          return [b.title, b.c];
        default:
          return [b.c];
      }
    })
    .join(" ")
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.round(words / 180));
}
