import assert from "node:assert/strict";
import { mock, test } from "node:test";

const MIN = 60_000;

type Db = typeof import("../lib/db/client").prisma;

async function withFakeDb<T>(fn: (prisma: Db) => Promise<T>): Promise<T> {
  const globalDb = globalThis as unknown as { prisma?: unknown };
  const previous = globalDb.prisma;
  const fakeDb = {
    $extends(): unknown { return fakeDb; },
    tenant: { findMany: async () => [] },
    order: { findMany: async () => [] },
    smsLog: { findMany: async () => [] },
    emailLog: { findMany: async () => [] },
  };
  globalDb.prisma = fakeDb;
  try {
    const { prisma } = await import("../lib/db/client");
    return await fn(prisma);
  } finally {
    mock.restoreAll();
    globalDb.prisma = previous;
  }
}

test("sweep sends only reminders whose QStash publish was lost", async () => {
  process.env.POPLY_API_URL = "https://messaging.test";
  process.env.POPLY_API_KEY = "test-key";
  await withFakeDb(async (prisma) => {
    const now = new Date("2026-11-12T10:00:00Z");
    const at = (minAgo: number) => new Date(now.getTime() - minAgo * MIN);
    mock.method(prisma.tenant, "findMany", async () => [{ id: "imba", reviewsDelayMinutes: 60 }]);
    let orderWhere: Record<string, unknown> | undefined;
    mock.method(prisma.order, "findMany", async (args: { where: Record<string, unknown> }) => {
      orderWhere = args.where;
      return [
        { id: "lost", tenantId: "imba", deliveredAt: at(90) },
        { id: "already-sent", tenantId: "imba", deliveredAt: at(90) },
        { id: "email-sent", tenantId: "imba", deliveredAt: at(90) },
        { id: "qstash-not-due", tenantId: "imba", deliveredAt: at(70) },
        { id: "too-old", tenantId: "imba", deliveredAt: at(60 + 7 * 60) },
        { id: "other-tenant", tenantId: "ghost", deliveredAt: at(90) },
      ];
    });
    mock.method(prisma.smsLog, "findMany", async () => [{ refId: "already-sent" }]);
    mock.method(prisma.emailLog, "findMany", async () => [{ refId: "email-sent" }]);
    const fetchMock = mock.method(globalThis, "fetch", async () => {
      throw new Error("no real network in tests");
    });

    const { sweepMissedReviewReminders } = await import("../lib/reviews/sweep");
    const sent: string[] = [];
    const result = await sweepMissedReviewReminders(now, async (id) => {
      sent.push(id);
      return { ok: true, channel: "sms", providerStatus: "sent" };
    });

    assert.deepEqual(sent, ["lost"]);
    assert.equal(result.sent, 1);
    assert.equal(result.due, 1);
    assert.equal(fetchMock.mock.callCount(), 0);
    assert.deepEqual(orderWhere?.tenantId, { in: ["imba"] });
    assert.equal(orderWhere?.status, "delivered");
    assert.deepEqual(orderWhere?.review, { is: null });
  });
});

test("sweep is a no-op when no tenant has reviews on, and survives a failing send", async () => {
  await withFakeDb(async (prisma) => {
    const { sweepMissedReviewReminders } = await import("../lib/reviews/sweep");
    let orderQueried = false;
    mock.method(prisma.order, "findMany", async () => { orderQueried = true; return []; });
    const empty = await sweepMissedReviewReminders(new Date(), async () => { throw new Error("must not send"); });
    assert.equal(empty.due, 0);
    assert.equal(orderQueried, false);

    const now = new Date("2026-11-12T10:00:00Z");
    mock.method(prisma.tenant, "findMany", async () => [{ id: "t", reviewsDelayMinutes: 5 }]);
    mock.method(prisma.order, "findMany", async () => [
      { id: "a", tenantId: "t", deliveredAt: new Date(now.getTime() - 30 * MIN) },
      { id: "b", tenantId: "t", deliveredAt: new Date(now.getTime() - 30 * MIN) },
    ]);
    const r = await sweepMissedReviewReminders(now, async (id) => {
      if (id === "a") throw new Error("provider down");
      return { ok: false, reason: "guest_order" };
    });
    assert.equal(r.sent, 0);
    assert.deepEqual(r.skipped, { error: 1, guest_order: 1 });
  });
});

test("chime keeps ringing for card orders that arrive already confirmed until acknowledged", async () => {
  const { hasOrderAwaitingAck } = await import("../lib/order-chime");
  const none = new Set<string>();
  assert.equal(hasOrderAwaitingAck([{ id: "cash", status: "pending" }], none), true);
  assert.equal(hasOrderAwaitingAck([{ id: "card", status: "confirmed" }], new Set(["card"])), true);
  assert.equal(hasOrderAwaitingAck([{ id: "card", status: "confirmed" }], none), false);
  assert.equal(hasOrderAwaitingAck([{ id: "card", status: "preparing" }], new Set(["card"])), false);
  assert.equal(hasOrderAwaitingAck([], new Set(["card"])), false);
});
