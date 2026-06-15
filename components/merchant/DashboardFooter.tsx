import Link from "next/link";

export function DashboardFooter() {
  return (
    <footer className="border-t border-qf-line-dash px-4 py-4">
      <div className="mx-auto w-full max-w-7xl flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-qf-mute">
        <span>QuickFood · גרסה 1.0</span>
        <span className="opacity-40">·</span>
        <Link href="/terms" className="hover:text-qf-ink hover:underline">
          תנאי שימוש
        </Link>
        <span className="opacity-40">·</span>
        <a
          href="https://quick-accessibility.vercel.app/s/5ezqwew2ypzj38js"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-qf-ink hover:underline"
        >
          מדיניות הנגשה
        </a>
      </div>
    </footer>
  );
}
