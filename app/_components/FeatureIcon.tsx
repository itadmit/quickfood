type IconName = "store" | "wallet" | "star" | "pin" | "chat" | "coin";

const PATHS: Record<IconName, React.ReactNode> = {
  store: (
    <>
      <path d="M4 10v9a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-9" />
      <path d="M3 10l1.5-5a1 1 0 0 1 1-.8h13a1 1 0 0 1 1 .8L21 10" />
      <path d="M3 10h18" />
      <path d="M8 10v2a2 2 0 1 1-4 0v-2" />
      <path d="M12 10v2a2 2 0 1 1-4 0v-2" />
      <path d="M16 10v2a2 2 0 1 1-4 0v-2" />
      <path d="M20 10v2a2 2 0 1 1-4 0v-2" />
      <path d="M10 20v-5h4v5" />
    </>
  ),
  wallet: (
    <>
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path d="M3 10h18" />
      <circle cx="16.5" cy="14.5" r="1.3" fill="currentColor" stroke="none" />
    </>
  ),
  star: (
    <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.2 1 5.9L12 17l-5.2 2.8 1-5.9L3.5 9.7l5.9-.9z" />
  ),
  pin: (
    <>
      <path d="M12 21s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z" />
      <circle cx="12" cy="9" r="2.6" />
    </>
  ),
  chat: (
    <>
      <path d="M4 12c0-3.9 3.6-7 8-7s8 3.1 8 7-3.6 7-8 7c-1 0-2-.1-2.9-.4L5 20l1.1-3.2C5 15.6 4 13.9 4 12z" />
    </>
  ),
  coin: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M14.5 9.5c-.5-.7-1.4-1-2.5-1-1.5 0-2.5.7-2.5 1.8s1 1.5 2.5 1.7 2.5.7 2.5 1.8-1 1.7-2.5 1.7c-1.1 0-2-.3-2.5-1" />
      <path d="M12 7.6v9" />
    </>
  ),
};

export default function FeatureIcon({ name }: { name: IconName }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {PATHS[name]}
    </svg>
  );
}

export type { IconName };
