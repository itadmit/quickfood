import Link from "next/link";
import { t } from "@/lib/i18n/dictionary";
import type { Lang } from "@/lib/i18n/langs";

export function CustomerFooter({
  tenantSlug,
  tenantName,
  lang = "he",
}: {
  tenantSlug: string;
  tenantName: string;
  lang?: Lang;
}) {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-qf-line-soft mt-6 px-5 pt-6 pb-28 lg:pb-6 text-center text-xs text-qf-mute space-y-2">
      <Link
        href={`/s/${tenantSlug}/terms`}
        className="font-medium text-qf-ink2 hover:text-qf-ink underline underline-offset-2"
      >
        {t("footer.terms", lang)}
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
          {t("footer.poweredBy", lang)} <span className="font-semibold">QuickFood</span>
        </a>
      </div>
    </footer>
  );
}
