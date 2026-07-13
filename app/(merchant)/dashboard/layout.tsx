import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import QRCode from "qrcode";
import { getSession, ADMIN_RETURN_COOKIE } from "@/lib/auth/session";
import { verifyAccess } from "@/lib/auth/jwt";
import { prisma } from "@/lib/db/client";
import { ImpersonationBanner } from "@/components/merchant/ImpersonationBanner";
import { ThemeProvider } from "@/components/shared/ThemeProvider";
import { AccessibilityWidget } from "@/components/shared/AccessibilityWidget";
import { Sidebar } from "@/components/merchant/Sidebar";
import { Topbar } from "@/components/merchant/Topbar";
import { SidebarV2 } from "@/components/merchant/v2/SidebarV2";
import { TopbarV2 } from "@/components/merchant/v2/TopbarV2";
import { BillingSetupBanner } from "@/components/merchant/BillingSetupBanner";
import { TrialGate } from "@/components/merchant/TrialGate";
import { OnboardingWelcome } from "@/components/merchant/OnboardingWelcome";
import { SupportFAB } from "@/components/merchant/SupportFAB";
import { DashboardFooter } from "@/components/merchant/DashboardFooter";
import { MerchantPushSubscribe } from "@/components/merchant/MerchantPushSubscribe";
import { MerchantInstallPrompt } from "@/components/merchant/MerchantInstallPrompt";
import { RoleRouteGuard } from "@/components/merchant/RoleRouteGuard";
import { TermsAckGate } from "@/components/merchant/TermsAckGate";
import { TermsAckBanner } from "@/components/merchant/TermsAckBanner";

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

  // A store that already pulled its menu from Wolt is not "new" - never nudge
  // it back into the onboarding / Wolt-import flow even if the item count
  // briefly reads 0 (write-then-read lag right after a commit).
  const hasCompletedWoltImport =
    (await prisma.woltImport.count({
      where: { tenantId: tenant.id, status: "committed" },
    })) > 0;
  // Same rule for a photo/PDF menu import: once committed the store isn't
  // "new", so don't nudge it back into onboarding (parity with Wolt - the
  // overlay was reappearing on entry after a file import).
  const hasCompletedMenuFileImport =
    (await prisma.menuFileImport.count({
      where: { tenantId: tenant.id, status: "committed" },
    })) > 0;
  const showOnboarding =
    hasNoMenuItems && !hasCompletedWoltImport && !hasCompletedMenuFileImport;

  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "https://quickfood.co.il").replace(/\/$/, "");
  const storefrontUrl = tenant.customDomain
    ? `https://${tenant.customDomain}`
    : `${base}/s/${tenant.slug}`;
  const storefrontQrDataUrl = await QRCode.toDataURL(storefrontUrl, {
    width: 512,
    margin: 2,
    color: { dark: "#000000", light: "#FFFFFF" },
  });

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

  // Platform admin "logged in as" this store - the signed return cookie lets
  // them pop back to /admin via the banner.
  const adminReturn = (await cookies()).get(ADMIN_RETURN_COOKIE)?.value;
  const impersonating = adminReturn
    ? (await verifyAccess(adminReturn))?.role === "platform_admin"
    : false;

  return (
    <ThemeProvider themeId={tenant.themeId}>
      <AccessibilityWidget />
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
          {impersonating && <ImpersonationBanner />}
          <TermsAckBanner acknowledged={!!tenant.termsAcknowledgedAt} />
          <BillingSetupBanner
            hasPaymentMethod={hasPaymentMethod}
            trialDaysLeft={trialDaysLeft}
            trialExpired={trialExpired}
          />
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
            showImportShortcut={showOnboarding}
            storefrontUrl={storefrontUrl}
            storefrontQrDataUrl={storefrontQrDataUrl}
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
                <MerchantInstallPrompt />
                {children}
              </div>
            </main>
          </div>
          <DashboardFooter />
          <TrialGate
            trialExpired={trialExpired}
            hasPaymentMethod={hasPaymentMethod}
          />
          <OnboardingWelcome
            merchantName={user.name}
            initialOpen={!tenant.onboardingDismissedAt && showOnboarding}
          />
          <SupportFAB merchantName={user.name} hasNoMenuItems={hasNoMenuItems} />
        </div>
      ) : (
        <div className="min-h-screen bg-qf-bg-dash text-qf-ink flex flex-col overflow-x-clip">
          {impersonating && <ImpersonationBanner />}
          <TermsAckBanner acknowledged={!!tenant.termsAcknowledgedAt} />
          <BillingSetupBanner
            hasPaymentMethod={hasPaymentMethod}
            trialDaysLeft={trialDaysLeft}
            trialExpired={trialExpired}
          />
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
            showImportShortcut={showOnboarding}
          />
          <div className="flex-1 flex">
            <Sidebar tenant={{ name: tenant.name, logoLetter: tenant.logoLetter, branchName: tenant.branches[0]?.name ?? "" }} role={user.role} />
            <main className="flex-1 min-w-0 p-3 lg:p-6 pb-20 lg:pb-6 overflow-x-clip">
              <div className="mx-auto w-full max-w-7xl space-y-3">
                <RoleRouteGuard role={user.role} />
                <MerchantPushSubscribe />
                <MerchantInstallPrompt />
                {children}
              </div>
            </main>
          </div>
          <DashboardFooter />
          <TrialGate
            trialExpired={trialExpired}
            hasPaymentMethod={hasPaymentMethod}
          />
          <OnboardingWelcome
            merchantName={user.name}
            initialOpen={!tenant.onboardingDismissedAt && showOnboarding}
          />
          <SupportFAB merchantName={user.name} hasNoMenuItems={hasNoMenuItems} />
        </div>
      )}
      {/* Gate kicks in once the store has a menu (i.e. they're "finishing"
          it) - a brand-new empty store sees the onboarding flow first, not
          the terms wall. */}
      <TermsAckGate acknowledged={!!tenant.termsAcknowledgedAt || hasNoMenuItems} />
    </ThemeProvider>
  );
}
