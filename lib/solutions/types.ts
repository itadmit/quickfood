import type { Block } from "@/lib/blog/types";

export type { Block };

export interface Solution {
  slug: string;
  /** <h1>. Leads with the query this page is for. */
  title: string;
  description: string;
  /** Header chip label. */
  chip: string;
  /** One line under the h1. */
  lede: string;
  body: Block[];
  /** Rendered as <details> and emitted as FAQPage JSON-LD. */
  faq: Array<{ q: string; a: string }>;
}
