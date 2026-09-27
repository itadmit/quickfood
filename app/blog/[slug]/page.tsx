import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { LegalShell } from "@/components/shared/LegalShell";
import { ArticleBody } from "@/components/marketing/ArticleBody";
import { POSTS, getPost, postModified, readingMinutes } from "@/lib/blog";
import { SITE_URL, ORG_ID } from "@/lib/site";

export function generateStaticParams() {
  return POSTS.map((post) => ({ slug: post.slug }));
}

// Nothing here is request-dependent, so every post prerenders at build time
// and an unknown slug 404s instead of being generated on demand.
export const dynamicParams = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) return {};

  const url = `${SITE_URL}/blog/${post.slug}`;
  return {
    title: `${post.title} | QuickFood`,
    description: post.description,
    keywords: post.tags,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      locale: "he_IL",
      url,
      siteName: "QuickFood",
      title: post.title,
      description: post.description,
      publishedTime: post.published,
      modifiedTime: postModified(post),
      tags: post.tags,
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.description,
    },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();

  const url = `${SITE_URL}/blog/${post.slug}`;
  const minutes = readingMinutes(post);

  // BlogPosting referencing the Organization emitted by the root layout, so
  // author/publisher resolve to one entity across the whole site instead of
  // a fresh duplicate per article.
  const schema = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "@id": `${url}#article`,
    headline: post.title,
    description: post.description,
    inLanguage: "he-IL",
    datePublished: post.published,
    dateModified: postModified(post),
    url,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    author: { "@id": ORG_ID },
    publisher: { "@id": ORG_ID },
    articleSection: post.category,
    keywords: post.tags.join(", "),
    isPartOf: { "@type": "Blog", "@id": `${SITE_URL}/blog#blog` },
  };

  const others = POSTS.filter((p) => p.slug !== post.slug).slice(0, 2);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
      <LegalShell
        title={post.title}
        subtitle={post.lede}
        lastUpdated={postModified(post)}
        chipLabel={`QUICKFOOD · ${post.category}`}
        backHref="/blog"
        backLabel="לכל המאמרים"
      >
        <p className="!mb-6 text-[13px] font-black tracking-wide text-black/55">
          זמן קריאה: {minutes} דקות
        </p>

        <ArticleBody blocks={post.body} />

        <section className="mt-10 rounded-2xl border-2 border-black bg-black p-6 text-white">
          <h2 className="!text-white !mb-2">רוצה לראות את זה על המסעדה שלך?</h2>
          <p className="!mb-5 text-white/80">
            אתר הזמנות משלך, על הדומיין שלך, עם התפריט המלא. מחברים ומתחילים
            למכור.
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

        {others.length > 0 && (
          <section className="mt-10">
            <h2>עוד בבלוג</h2>
            <ul className="!list-none !ps-0">
              {others.map((other) => (
                <li key={other.slug} className="!mb-3">
                  <Link href={`/blog/${other.slug}`} className="font-black">
                    {other.title}
                  </Link>
                  <span className="block text-[14px] font-normal text-black/60 no-underline">
                    {other.description}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </LegalShell>
    </>
  );
}
