import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { LegalShell } from "@/components/shared/LegalShell";
import { ArticleBody } from "@/components/marketing/ArticleBody";
import { SOLUTIONS, getSolution } from "@/lib/solutions";
import { SITE_URL, ORG_ID } from "@/lib/site";

export function generateStaticParams() {
  return SOLUTIONS.map((s) => ({ slug: s.slug }));
}

export const dynamicParams = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const solution = getSolution(slug);
  if (!solution) return {};

  const url = `${SITE_URL}/solutions/${solution.slug}`;
  return {
    title: `${solution.title} | QuickFood`,
    description: solution.description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      locale: "he_IL",
      url,
      siteName: "QuickFood",
      title: solution.title,
      description: solution.description,
    },
    twitter: {
      card: "summary_large_image",
      title: solution.title,
      description: solution.description,
    },
  };
}

export default async function SolutionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const solution = getSolution(slug);
  if (!solution) notFound();

  const url = `${SITE_URL}/solutions/${solution.slug}`;

  // WebPage + FAQPage. The FAQ block is what can earn extra SERP height on
  // these commercial queries, so the questions here are the ones merchants
  // actually ask on the phone - not filler.
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": url,
        url,
        name: solution.title,
        description: solution.description,
        inLanguage: "he-IL",
        isPartOf: { "@id": `${SITE_URL}/#website` },
        about: { "@id": ORG_ID },
      },
      {
        "@type": "FAQPage",
        "@id": `${url}#faq`,
        mainEntity: solution.faq.map((item) => ({
          "@type": "Question",
          name: item.q,
          acceptedAnswer: { "@type": "Answer", text: item.a },
        })),
      },
    ],
  };

  const others = SOLUTIONS.filter((s) => s.slug !== solution.slug);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
      <LegalShell
        title={solution.title}
        subtitle={solution.lede}
        chipLabel={solution.chip}
        backHref="/"
        backLabel="לדף הבית"
      >
        <ArticleBody blocks={solution.body} />

        <section className="mt-10 rounded-2xl border-2 border-black bg-black p-6 text-white">
          <h2 className="!text-white !mb-2">מחברים ומתחילים למכור</h2>
          <p className="!mb-5 text-white/80">
            ייבוא התפריט, הצבעים שלך, וקישור אחד שהלקוחות שומרים בטלפון.
          </p>
          <Link
            href="/signup"
            className="inline-block rounded-full border-2 border-black bg-[#F8CB1E] px-6 py-3 text-[15px] font-black !text-black !no-underline shadow-[0_3px_0_#000] transition active:translate-y-px active:shadow-[0_1px_0_#000]"
          >
            התחילו 7 ימים חינם
          </Link>
          <p className="!mb-0 mt-3 text-[13px] text-white/60">
            בלי כרטיס אשראי. בלי התחייבות.
          </p>
        </section>

        <section className="mt-10">
          <h2>שאלות נפוצות</h2>
          {solution.faq.map((item, i) => (
            <details
              key={i}
              className="border-b border-black/15 py-4 last:border-b-0"
            >
              <summary className="cursor-pointer text-[15px] font-black">
                {item.q}
              </summary>
              <p className="!mb-0 mt-2 text-black/75">{item.a}</p>
            </details>
          ))}
        </section>

        <section className="mt-10">
          <h2>עוד עמודים שיכולים לעניין אותך</h2>
          <ul className="!list-none !ps-0">
            {others.map((other) => (
              <li key={other.slug} className="!mb-3">
                <Link
                  href={`/solutions/${other.slug}`}
                  className="font-black"
                >
                  {other.title}
                </Link>
                <span className="block text-[14px] font-normal text-black/60">
                  {other.description}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </LegalShell>
    </>
  );
}
