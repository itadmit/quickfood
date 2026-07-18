import Link from "next/link";

export function CustomerFooter({
  tenantSlug,
  tenantName,
}: {
  tenantSlug: string;
  tenantName: string;
}) {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-qf-line-soft mt-6 px-5 py-6 text-center text-xs text-qf-mute space-y-2">
      <Link
        href={`/s/${tenantSlug}/terms`}
        className="font-medium text-qf-ink2 hover:text-qf-ink underline underline-offset-2"
      >
        תקנון ותנאי שימוש
      </Link>
      <div>
        © {year} {tenantName}
      </div>
      <div>
        <a
          href="https://quickfood.co.il/?utm_source=storefront&utm_medium=footer_credit"
          target="_blank"
          rel="noopener noreferrer"
          className="text-qf-mute hover:text-qf-ink2 transition"
        >
          מופעל על ידי <span className="font-semibold">QuickFood</span>
        </a>
      </div>
    </footer>
  );
}
