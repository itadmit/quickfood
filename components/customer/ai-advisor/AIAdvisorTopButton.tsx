"use client";

export function AIAdvisorTopButton() {
  function open() {
    window.dispatchEvent(new CustomEvent("qf:open-ai-advisor"));
  }

  return (
    <button
      type="button"
      onClick={open}
      aria-label="פתח יועץ AI"
      className="grid w-10 h-10 place-items-center rounded-full bg-black text-white border-2 border-black shadow-lg shadow-black/30 hover:scale-105 active:scale-95 transition"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M12 3l1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9L12 3z"
          fill="#ffffff"
        />
        <path
          d="M19 14l.9 2.1L22 17l-2.1.9L19 20l-.9-2.1L16 17l2.1-.9L19 14z"
          fill="#ffffff"
        />
      </svg>
    </button>
  );
}
