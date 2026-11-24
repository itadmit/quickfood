import assert from "node:assert/strict";
import test from "node:test";
import { declineMessage } from "../lib/payments/decline-message";

test("Hyp CCode 6 (S-40, S-42) tells the customer the ID or CVV is wrong", () => {
  assert.match(declineMessage("hyp", { CCode: "6" }), /תעודת הזהות או 3 הספרות/);
  assert.match(declineMessage("hyp", { CCode: "006" }), /תעודת הזהות/);
});

test("unknown codes, other providers and missing data fall back to a generic line", () => {
  assert.equal(declineMessage("hyp", { CCode: "999" }), "הכרטיס לא חויב.");
  assert.equal(declineMessage("grow", { CCode: "6" }), "הכרטיס לא חויב.");
  assert.equal(declineMessage("hyp", null), "הכרטיס לא חויב.");
});
