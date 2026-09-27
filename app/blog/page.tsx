import Link from "next/link";
import type { Metadata } from "next";
import { LegalShell } from "@/components/shared/LegalShell";
import { POSTS, postModified, readingMinutes } from "@/lib/blog";
import { SITE_URL, ORG_ID } from "@/lib/site";

const DESCRIPTION =
  "מדריכים מעשיים לניהול הצד העסקי של מסעדה: כמה באמת עולה הזמנה באגרגטור, איך להחזיר את הלקוחות הקבועים להזמנה ישירה, ואיך לבנות תפריט דיגיטלי שמוכר יותר.";

export const metadata: Metadata = {
  title: "הבלוג של QuickFood - רווחיות, תפריט ולקוחות חוזרים",
  description: DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/blog` },
};

export default function BlogPage() {
  // Blog + ItemList so the listing is eligible to show as a set of articles
  // rather than one generic page.
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Blog",
        "@id": `${SITE_URL}/blog#blog`,
        url: `${SITE_URL}/blog`,
        name: "הבלוג של QuickFood",
        description: DESCRIPTION,
        inLanguage: "he-IL",
        publisher: { "@id": ORG_ID },
      },
      {
        "@type": "ItemList",
        itemListElement: POSTS.map((post, i) => ({
          "@type": "ListItem",
          position: i + 1,
          url: `${SITE_URL}/blog/${post.slug}`,
          name: post.title,
        })),
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
      <LegalShell
        title="הבלוג"
        subtitle="הצד העסקי של ניהול מסעדה - מספרים מהשטח, לא תיאוריה. איך לחשב מה הזמנה באמת עולה לך, איך להחזיר את הלקוחות הקבועים, ואיך לבנות תפריט שמוכר."
        chipLabel="QUICKFOOD · בלוג"
        backHref="/"
        backLabel="לדף הבית"
      >
        <ul className="!list-none !ps-0 !my-0">
          {POSTS.map((post) => (
            <li
              key={post.slug}
              className="!mb-0 border-b-2 border-black/10 py-6 first:pt-0 last:border-b-0 last:pb-0"
            >
              <div className="mb-2 flex items-center gap-2 text-[12px] font-black tracking-wide text-black/55">
                <span className="rounded-full bg-black/[0.07] px-2.5 py-1">
                  {post.category}
                </span>
                <span>{readingMinutes(post)} דקות קריאה</span>
              </div>
              <h2 className="!mb-2">
                <Link href={`/blog/${post.slug}`} className="!no-underline">
                  {post.title}
                </Link>
              </h2>
              <p className="!mb-3 text-black/70">{post.description}</p>
              <Link
                href={`/blog/${post.slug}`}
                className="text-[14px] font-black"
              >
                קרא את המדריך
              </Link>
              <time
                className="mt-2 block text-[12px] font-bold text-black/45"
                dateTime={postModified(post)}
              >
                {formatHebrewDate(postModified(post))}
              </time>
            </li>
          ))}
        </ul>

        <section className="mt-10">
          <h2>יש נושא שאתה רוצה שנעמיק בו?</h2>
          <p>
            עמלות, KPI, אופטימיזציה של תפריט, UX של checkout, שיווק ב-SMS -
            תכתוב לנו ל-
            <a href="mailto:hello@quickfood.co.il">hello@quickfood.co.il</a> ונוסיף
            את זה לרשימה.
          </p>
        </section>
      </LegalShell>
    </>
  );
}

function formatHebrewDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const months = [
    "ינואר",
    "פברואר",
    "מרץ",
    "אפריל",
    "מאי",
    "יוני",
    "יולי",
    "אוגוסט",
    "ספטמבר",
    "אוקטובר",
    "נובמבר",
    "דצמבר",
  ];
  return `${d.getDate()} ב${months[d.getMonth()]} ${d.getFullYear()}`;
}
