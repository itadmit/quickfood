"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import LoginForm from "./LoginForm";
import EmailOtpLoginForm from "./EmailOtpLoginForm";

type Mode = "otp" | "password";

export default function LoginPanel() {
  const [mode, setMode] = useState<Mode>("otp");

  return (
    <div className="space-y-5">
      <div
        role="tablist"
        aria-label="אופן התחברות"
        className="grid grid-cols-2 gap-2 p-1 rounded-2xl border-2 border-black bg-[#FFFBEC] shadow-[0_2px_0_#000]"
      >
        <TabButton active={mode === "otp"} onClick={() => setMode("otp")}>
          קוד חד-פעמי
        </TabButton>
        <TabButton active={mode === "password"} onClick={() => setMode("password")}>
          אימייל וסיסמה
        </TabButton>
      </div>

      {mode === "otp" ? <EmailOtpLoginForm /> : <LoginForm />}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "py-2.5 rounded-xl text-sm font-black border-2 transition",
        active
          ? "bg-[#F8CB1E] border-black text-black shadow-[0_3px_0_#000] -translate-y-px"
          : "bg-transparent border-transparent text-black/55 hover:text-black",
      )}
    >
      {children}
    </button>
  );
}
