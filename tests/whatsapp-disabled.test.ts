import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { sendWhatsApp, sendRawWhatsApp, callIBotSendText } from "../lib/whatsapp/send";
import { sendViaQuickChat, isQuickChatConfigured } from "../lib/whatsapp/quickchat";
import { resolveOrderNotifySettings, resolveMerchantNewOrderSettings } from "../lib/messaging/notify-settings";
import { resolveMessagingAvailability } from "../lib/messaging/availability";

test("all WhatsApp transports are disabled without any outbound requests", async () => {
  const fetch = mock.method(globalThis, "fetch", () => { throw new Error("must not send"); });
  try {
    assert.equal((await sendWhatsApp({ tenantId: "test", to: "0501234567", body: "test", useManagedAccount: true })).status, "not_configured");
    assert.equal((await sendRawWhatsApp("0501234567", "test")).status, "not_configured");
    assert.equal((await callIBotSendText({ token: "old", instanceId: "old", jid: "old", msg: "test" })).ok, false);
    assert.equal(isQuickChatConfigured(), false);
    assert.equal((await sendViaQuickChat({ phone: "0501234567", text: "test", template: { name: "old", variables: [] }, idempotencyKey: "test" })).ok, false);
    assert.equal(fetch.mock.callCount(), 0);
  } finally { mock.restoreAll(); }
});

test("legacy WhatsApp order preferences resolve to SMS, preserving disabled events", () => {
  const settings = resolveOrderNotifySettings({ ready: { enabled: false, channel: "whatsapp_managed" } }, "whatsapp");
  assert.equal(settings.confirmed.channel, "sms");
  assert.equal(settings.confirmed.enabled, true);
  assert.equal(settings.ready.channel, "sms");
  assert.equal(settings.ready.enabled, false);
  assert.equal(resolveMerchantNewOrderSettings({ merchant_new_order: { email: true, whatsapp: true } }).whatsapp, false);
});

test("stored WhatsApp credits remain intact but never enable the discontinued channel", () => {
  const availability = resolveMessagingAvailability({ smsCreditsRemaining: 5, whatsappCreditsRemaining: 300, whatsappEnabled: true, whatsappToken: "old", whatsappInstanceId: "old", reviewsWhatsappSubscriptionId: "old" });
  assert.equal(availability.whatsappCredits, 300);
  assert.equal(availability.whatsappAvailable, false);
  assert.equal(availability.managedActive, false);
  assert.equal(availability.smsAvailable, true);
});
