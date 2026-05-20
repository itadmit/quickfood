import { SettingsTabs } from "../SettingsTabs";
import { ComingSoon } from "@/components/merchant/ComingSoon";

export default function BusinessSettingsPage() {
  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold">הגדרות</h1>
        <p className="text-sm text-qf-mute">פרטי עסק</p>
      </header>
      <SettingsTabs />
      <ComingSoon
        title="פרטי עסק"
        subtitle="כתובת, טלפון, ח״פ, ניהול סניפים — בקרוב"
      />
    </div>
  );
}
