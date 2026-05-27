"use client";

/**
 * Small sparkle-icon button that pops the AI advisor modal.
 * Dispatched as a sibling of the existing FAB — the FAB component
 * listens for the same custom event and opens its own modal.
 *
 * Use this where you want an always-on entry point that doesn't
 * dominate the screen the way the floating FAB does (e.g. next to
 * the profile icon in the storefront hero).
 */
export function AIAdvisorTopButton({ className = "" }: { className?: string }) {
  function open() {
    window.dispatchEvent(new CustomEvent("qf:open-ai-advisor"));
  }
  return (
    <button
      type="button"
      onClick={open}
      aria-label="פתח יועץ AI"
      className={`w-9 h-9 rounded-full bg-white grid place-items-center shadow-sm ${className}`}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M12 3l1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9L12 3z"
          fill="var(--qf-deep)"
        />
        <path
          d="M19 14l.9 2.1L22 17l-2.1.9L19 20l-.9-2.1L16 17l2.1-.9L19 14z"
          fill="var(--qf-deep)"
        />
      </svg>
    </button>
  );
}
