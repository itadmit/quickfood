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
    </footer>
  );
}
