import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { normalizeSmsPhone } from "../lib/sms/phone";
import { smsFailureMessage } from "../lib/sms/messages";

test("normalize international Israeli phones without accepting incomplete numbers", () => {
  for (const value of ["050-1234567", "+972501234567", "972501234567", "00972501234567"]) {
    assert.equal(normalizeSmsPhone(value), "0501234567");
  }
  assert.equal(normalizeSmsPhone("054228428"), "054228428");
});

test("customer errors do not disclose the messaging provider or upstream credentials", () => {
  for (const error of ["Incorrect key, username or password", "poply_not_configured", "poply_http_401", "SMS4FREE_PASSWORD missing"]) {
    assert.doesNotMatch(smsFailureMessage(error), /poply|sms4free|password|key|username/i);
  }
});

test("SMS tests and notifications use only the central API, preserve billing and never fall back", async () => {
  process.env.POPLY_API_URL = "https://messaging.test";
  process.env.POPLY_API_KEY = "test-key";
  process.env.SMS4FREE_API_KEY = "legacy-key-must-never-be-used";
  process.env.SMS4FREE_USER = "legacy-user";
  process.env.SMS4FREE_PASS = "legacy-pass";
  delete process.env.SMS_PROVIDER;
  const globalDb = globalThis as unknown as { prisma?: unknown };
  const previousDb = globalDb.prisma;
  const fakeDb = {
    $extends(): unknown { return fakeDb; },
    tenant: { findUnique: async () => ({}), update: async () => ({}) },
    smsLog: { create: async () => ({}), update: async () => ({}) },
  };
  globalDb.prisma = fakeDb;
  const { prisma } = await import("../lib/db/client");
  const { sendSms } = await import("../lib/sms/send");
  const requests: { url: string; body: Record<string, unknown> }[] = [];
  let debitCount = 0;
  let accepted = true;
  mock.method(prisma.tenant, "findUnique", async () => ({ smsCreditsRemaining: 5, smsSender: "MyStore" }));
  mock.method(prisma.tenant, "update", async () => { debitCount++; return {}; });
  mock.method(prisma.smsLog, "create", async () => ({ id: "test-log" }));
  mock.method(prisma.smsLog, "update", async () => ({}));
  mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    requests.push({ url, body: JSON.parse(init.body as string) });
    return Response.json(accepted ? { ok: true, id: "provider-log" } : { error: "Incorrect key, username or password" }, { status: accepted ? 200 : 502 });
  });
  try {
    const input = { tenantId: "tenant", to: "+972501234567", body: "בדיקה", kind: "test", skipCredit: true };
    assert.equal((await sendSms(input)).status, "sent");
    assert.equal(debitCount, 0, "test send must not charge merchant");
    assert.deepEqual(requests[0], { url: "https://messaging.test/api/v1/send-sms", body: { to: "0501234567", message: "בדיקה", sender: "MyStore" } });
    assert.equal((await sendSms({ ...input, skipCredit: false })).status, "sent");
    assert.equal(debitCount, 1);
    accepted = false;
    const failed = await sendSms(input);
    assert.equal(failed.status, "failed");
    assert.doesNotMatch(failed.providerMsg!, /password|username|poply|sms4free/i);
    assert.equal(requests.length, 3, "rejection must not cause another-provider send");
    assert.equal(debitCount, 1);
  } finally { mock.restoreAll(); globalDb.prisma = previousDb; }
});
