/**
 * Article content is stored as typed blocks rather than markdown - the project
 * has no markdown dependency, and blocks let the renderer emit exactly the
 * markup `legal-prose` already styles (plus tables and CTAs, which markdown
 * would not give us control over).
 *
 * Paragraph, list and cell text supports two inline forms, rendered by
 * `renderInline`: `**bold**` and `[label](href)`.
 */
export type Block =
  | { t: "p"; c: string }
  | { t: "h2"; c: string }
  | { t: "h3"; c: string }
  | { t: "ul"; items: string[] }
  | { t: "ol"; items: string[] }
  | { t: "quote"; c: string }
  | { t: "table"; caption?: string; head: string[]; rows: string[][] }
  | { t: "callout"; title: string; c: string };

export interface Post {
  slug: string;
  /** <h1> and <title>. Front-load the query it targets. */
  title: string;
  /** Meta description + listing teaser. ~150-160 chars. */
  description: string;
  /** ISO date. Drives datePublished and the sitemap's lastModified. */
  published: string;
  /** ISO date, when meaningfully revised. Drives dateModified. */
  updated?: string;
  /** Short label shown on the listing card. */
  category: string;
  /** Keywords/topics - also emitted as JSON-LD `keywords`. */
  tags: string[];
  /** One-line hook under the h1. */
  lede: string;
  body: Block[];
}
