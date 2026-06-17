import { Fragment } from "react";

/**
 * Renders the lightweight markdown-ish legal text produced by
 * lib/legal/terms.ts (and merchant overrides) WITHOUT dangerouslySetInnerHTML:
 *   "## heading"  → section heading
 *   "- item"      → bullet list
 *   "**bold**"    → bold inline
 *   blank line    → paragraph break
 */
function renderInline(text: string, keyBase: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={`${keyBase}-${i}`} className="font-semibold text-qf-ink">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <Fragment key={`${keyBase}-${i}`}>{part}</Fragment>;
  });
}

export function LegalText({ text }: { text: string }) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks: React.ReactNode[] = [];
  let list: string[] = [];

  const flushList = (key: string) => {
    if (list.length === 0) return;
    blocks.push(
      <ul key={key} className="list-disc pr-5 space-y-1 text-qf-ink2">
        {list.map((li, i) => (
          <li key={i}>{renderInline(li, `${key}-${i}`)}</li>
        ))}
      </ul>,
    );
    list = [];
  };

  lines.forEach((raw, idx) => {
    const line = raw.trimEnd();
    if (line.startsWith("## ")) {
      flushList(`ul-${idx}`);
      blocks.push(
        <h2 key={`h-${idx}`} className="font-bold text-lg text-qf-ink mt-6 first:mt-0">
          {line.slice(3)}
        </h2>,
      );
    } else if (line.startsWith("- ")) {
      list.push(line.slice(2));
    } else if (line.trim() === "") {
      flushList(`ul-${idx}`);
    } else {
      flushList(`ul-${idx}`);
      blocks.push(
        <p key={`p-${idx}`} className="text-qf-ink2 leading-relaxed">
          {renderInline(line, `p-${idx}`)}
        </p>,
      );
    }
  });
  flushList("ul-end");

  return <div className="space-y-2.5 text-sm">{blocks}</div>;
}
