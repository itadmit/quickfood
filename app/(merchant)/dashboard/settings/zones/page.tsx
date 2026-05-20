import { SettingsTabs } from "../SettingsTabs";
import { ComingSoon } from "@/components/merchant/ComingSoon";

export default function ZonesSettingsPage() {
  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold">הגדרות</h1>
        <p className="text-sm text-qf-mute">אזורי משלוח</p>
      </header>
      <SettingsTabs />
      <ComingSoon title="אזורי משלוח" subtitle="הגדרת זונות עם מחיר וזמן — בקרוב" />
    </div>
  );
}
