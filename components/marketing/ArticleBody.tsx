import Link from "next/link";
import type { Block } from "@/lib/blog";

/**
 * Renders the typed article blocks into the markup `legal-prose` styles.
 * Server-only - no interactivity, so the whole article ships as static HTML
 * (which is also what makes it cheap for Google to crawl).
 */
export function ArticleBody({ blocks }: { blocks: Block[] }) {
  return (
    <>
      {blocks.map((block, i) => (
        <BlockView key={i} block={block} />
      ))}
    </>
  );
}

function BlockView({ block }: { block: Block }) {
  switch (block.t) {
    case "h2":
      return <h2>{renderInline(block.c)}</h2>;
    case "h3":
      return <h3>{renderInline(block.c)}</h3>;
    case "p":
      return <p>{renderInline(block.c)}</p>;
    case "ul":
      return (
        <ul>
          {block.items.map((item, i) => (
            <li key={i}>{renderInline(item)}</li>
          ))}
        </ul>
      );
    case "ol":
      return (
        <ol>
          {block.items.map((item, i) => (
            <li key={i}>{renderInline(item)}</li>
          ))}
        </ol>
      );
    case "quote":
      return (
        <blockquote className="my-6 border-s-4 border-black bg-black/[0.04] px-5 py-4 text-[17px] font-bold leading-relaxed">
          {renderInline(block.c)}
        </blockquote>
      );
    case "callout":
      return (
        <aside className="my-6 rounded-2xl border-2 border-black bg-[#F8CB1E]/25 p-5">
          <p className="mb-1 text-[13px] font-black tracking-wide uppercase">
            {block.title}
          </p>
          <p className="!mb-0">{renderInline(block.c)}</p>
        </aside>
      );
    case "table":
      return (
        <figure className="my-6">
          <div className="overflow-x-auto rounded-2xl border-2 border-black">
            <table className="w-full border-collapse text-[14px]">
              <thead>
                <tr className="bg-black text-white">
                  {block.head.map((h, i) => (
                    <th key={i} className="p-3 text-start font-black">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, r) => (
                  <tr key={r} className="border-t border-black/15">
                    {row.map((cell, c) => (
                      <td
                        key={c}
                        className={
                          c === 0 ? "p-3 font-bold align-top" : "p-3 align-top"
                        }
                      >
                        {renderInline(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {block.caption && (
            <figcaption className="mt-2 text-center text-[12px] font-bold text-black/55">
              {block.caption}
            </figcaption>
          )}
        </figure>
      );
  }
}

const INLINE = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)]+)\)/g;

/** Turns `**bold**` and `[label](href)` into elements, leaving the rest as text. */
function renderInline(text: string): React.ReactNode {
  const out: React.ReactNode[] = [];
  let last = 0;
  let key = 0;

  for (const m of text.matchAll(INLINE)) {
    const at = m.index;
    if (at > last) out.push(text.slice(last, at));

    if (m[1] !== undefined) {
      out.push(<strong key={key++}>{m[1]}</strong>);
    } else {
      const [, , label, href] = m;
      out.push(
        href.startsWith("/") ? (
          <Link key={key++} href={href}>
            {label}
          </Link>
        ) : (
          <a key={key++} href={href} rel="noopener">
            {label}
          </a>
        ),
      );
    }
    last = at + m[0].length;
  }

  if (last < text.length) out.push(text.slice(last));
  return out.length === 1 ? out[0] : out;
}
