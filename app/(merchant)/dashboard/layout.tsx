import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { ThemeProvider } from "@/components/shared/ThemeProvider";
import { Sidebar } from "@/components/merchant/Sidebar";
import { Topbar } from "@/components/merchant/Topbar";
import { SidebarV2 } from "@/components/merchant/v2/SidebarV2";
import { TopbarV2 } from "@/components/merchant/v2/TopbarV2";
import { BillingSetupBanner } from "@/components/merchant/BillingSetupBanner";
import { EmailVerificationBanner } from "@/components/merchant/EmailVerificationBanner";
import { TrialGate } from "@/components/merchant/TrialGate";
import { OnboardingWelcome } from "@/components/merchant/OnboardingWelcome";
import { SupportFAB } from "@/components/merchant/SupportFAB";
import { MerchantPushSubscribe } from "@/components/merchant/MerchantPushSubscribe";
import { RoleRouteGuard } from "@/components/merchant/RoleRouteGuard";

export const metadata: Metadata = {
  manifest: "/manifest-merchant.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "QuickFood",
  },
  other: {
    "apple-mobile-web-app-capable": "yes",
    "mobile-web-app-capable": "yes",
  },
};

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session || session.type !== "merchant") {
    redirect("/dashboard/login");
  }
  // Cashier role is locked to /pos at the route level too - bouncing
  // here avoids a wasted SSR render before the client guard kicks in.
  if (session.role === "cashier") {
    redirect("/pos");
  }

  const tenant = session.tenantId
    ? await prisma.tenant.findUnique({
        where: { id: session.tenantId },
        include: { branches: { where: { isPrimary: true }, take: 1 } },
      })
    : null;

  const user = await prisma.merchantUser.findUnique({
    where: { id: session.userId },
    select: { id: true, name: true, email: true, role: true, emailVerifiedAt: true },
  });

  if (!tenant || !user) {
    redirect("/dashboard/login");
  }

  // Used by the Topbar "import shortcut" button + the welcome overlay
  // gate. A `count` is cheap enough to run on every dashboard load (the
  // tenantId index makes it sub-ms). When > 0 the import shortcut hides
  // because the menu is clearly already populated.
  const menuItemCount = await prisma.menuItem.count({
    where: { tenantId: tenant.id },
  });
  const hasNoMenuItems = menuItemCount === 0;

  const hasPaymentMethod = !!tenant.billingPaymentMethodId;
  const trialExpired = tenant.trialEndsAt
    ? tenant.trialEndsAt.getTime() < Date.now()
    : false;
  const trialDaysLeft = tenant.trialEndsAt
    ? Math.max(
        0,
        Math.ceil((tenant.trialEndsAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)),
      )
    : null;

  // V2 = bold yellow/black brand shell (default for new tenants), V1 =
  // legacy slate dashboard. Switched per-tenant from Settings → Advanced,
  // so the merchant can flip between skins without us touching the route.
  const isV2 = tenant.dashboardVersion === "v2";

  // Email verification takes precedence over the trial/billing banner -
  // showing both at once piles two CTAs on top of each other and makes the
  // dashboard feel anxious. Billing surfaces only after the user has
  // verified the email; the trial timer keeps ticking either way.
  const emailVerified = !!user.emailVerifiedAt;

  return (
    <ThemeProvider themeId={tenant.themeId}>
      {isV2 ? (
        // `dash-v2` is the hook that retunes the design tokens (qf-bg,
        // qf-ink, qf-line, qf-green → cream / black / yellow) for every
        // descendant, so inner pages built with the legacy classes pick
        // up the V2 aesthetic without code changes. The dot pattern +
        // cream backdrop are inline because they reach through the dot
        // grid behind the cards.
        <div
          // `overflow-x-clip` (not `-hidden`) - `-hidden` implies a
          // scroll container, which captures the page scroll and
          // breaks the sidebar's `position: sticky`. `-clip` clips
          // overflow without creating a new scroll context.
          className="dash-v2 min-h-screen text-black flex flex-col overflow-x-clip"
          style={{
            backgroundColor: "#FFFBEC",
            backgroundImage:
              "radial-gradient(circle, rgba(0,0,0,0.07) 1px, transparent 1px)",
            backgroundSize: "22px 22px",
          }}
        >
          <EmailVerificationBanner
            emailVerifiedAt={user.emailVerifiedAt?.toISOString() ?? null}
            email={user.email}
          />
          {emailVerified && (
            <BillingSetupBanner
              hasPaymentMethod={hasPaymentMethod}
              trialDaysLeft={trialDaysLeft}
              trialExpired={trialExpired}
            />
          )}
          <TopbarV2
            user={user}
            tenantSlug={tenant.slug}
            tenant={{
              name: tenant.name,
              logoLetter: tenant.logoLetter,
              branchName: tenant.branches[0]?.name ?? "",
            }}
            branch={
              tenant.branches[0]
                ? {
                    id: tenant.branches[0].id,
                    status: tenant.branches[0].status,
                  }
                : null
            }
            showImportShortcut={hasNoMenuItems}
          />
          <div className="flex-1 flex">
            <SidebarV2
              role={user.role}
              tenant={{
                name: tenant.name,
                logoLetter: tenant.logoLetter,
                branchName: tenant.branches[0]?.name ?? "",
              }}
            />
            <main className="flex-1 min-w-0 p-3 lg:p-6 pb-20 lg:pb-6 overflow-x-clip">
              <div className="mx-auto w-full max-w-7xl space-y-3">
                <RoleRouteGuard role={user.role} />
                <MerchantPushSubscribe />
                {children}
              </div>
            </main>
          </div>
          <TrialGate
            trialExpired={trialExpired}
            hasPaymentMethod={hasPaymentMethod}
          />
          <OnboardingWelcome
            merchantName={user.name}
            initialOpen={!tenant.onboardingDismissedAt && hasNoMenuItems}
          />
          <SupportFAB merchantName={user.name} hasNoMenuItems={hasNoMenuItems} />
        </div>
      ) : (
        <div className="min-h-screen bg-qf-bg-dash text-qf-ink flex flex-col overflow-x-clip">
          <EmailVerificationBanner
            emailVerifiedAt={user.emailVerifiedAt?.toISOString() ?? null}
            email={user.email}
          />
          {emailVerified && (
            <BillingSetupBanner
              hasPaymentMethod={hasPaymentMethod}
              trialDaysLeft={trialDaysLeft}
              trialExpired={trialExpired}
            />
          )}
          <Topbar
            user={user}
            tenantSlug={tenant.slug}
            tenant={{
              name: tenant.name,
              logoLetter: tenant.logoLetter,
              branchName: tenant.branches[0]?.name ?? "",
            }}
            branch={
              tenant.branches[0]
                ? {
                    id: tenant.branches[0].id,
                    status: tenant.branches[0].status,
                  }
                : null
            }
            showImportShortcut={hasNoMenuItems}
          />
          <div className="flex-1 flex">
            <Sidebar tenant={{ name: tenant.name, logoLetter: tenant.logoLetter, branchName: tenant.branches[0]?.name ?? "" }} role={user.role} />
            <main className="flex-1 min-w-0 p-3 lg:p-6 pb-20 lg:pb-6 overflow-x-clip">
              <div className="mx-auto w-full max-w-7xl space-y-3">
                <RoleRouteGuard role={user.role} />
                <MerchantPushSubscribe />
                {children}
              </div>
            </main>
          </div>
          <TrialGate
            trialExpired={trialExpired}
            hasPaymentMethod={hasPaymentMethod}
          />
          <OnboardingWelcome
            merchantName={user.name}
            initialOpen={!tenant.onboardingDismissedAt && hasNoMenuItems}
          />
          <SupportFAB merchantName={user.name} hasNoMenuItems={hasNoMenuItems} />
        </div>
      )}
    </ThemeProvider>
  );
}
