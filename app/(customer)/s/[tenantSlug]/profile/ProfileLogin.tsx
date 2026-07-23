"use client";

import { useRouter, useParams } from "next/navigation";
import { IcoPhoneSms } from "@/components/shared/Icons";
import { CustomerOtpLogin } from "@/components/customer/CustomerOtpLogin";

export function ProfileLogin() {
  const router = useRouter();
  const params = useParams();
  const tenantSlug = typeof params?.tenantSlug === "string" ? params.tenantSlug : undefined;

  return (
    <div className="px-5 py-8 space-y-4 lg:max-w-md lg:mx-auto lg:p-8 lg:bg-white lg:border lg:border-qf-line lg:rounded-3xl lg:shadow-xs lg:mt-6">
      <div className="flex flex-col items-center text-center">
        <div className="w-20 h-20 rounded-full bg-(--qf-soft) grid place-items-center mb-3">
          <IcoPhoneSms c="var(--qf-primary)" s={36} />
        </div>
        <h2 className="text-xl font-bold">התחברות עם טלפון</h2>
        <p className="text-sm text-qf-mute mt-1">נשלח לך קוד אימות בוואטסאפ</p>
      </div>

      <CustomerOtpLogin tenantSlug={tenantSlug} onSuccess={() => router.refresh()} />
    </div>
  );
}
