import { SettingsTabs } from "../SettingsTabs";
import { ComingSoon } from "@/components/merchant/ComingSoon";

export default function HoursSettingsPage() {
  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold">הגדרות</h1>
        <p className="text-sm text-qf-mute">שעות פעילות</p>
      </header>
      <SettingsTabs />
      <ComingSoon title="שעות פעילות" subtitle="עורך שעות לכל יום — בקרוב" />
    </div>
  );
}
