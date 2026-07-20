#!/usr/bin/env node
/**
 * CardCom v11 sandbox e2e tester.
 *
 * Exercises the exact API contract lib/payments/providers/cardcom.ts relies on,
 * against CardCom's real host using the shared TEST terminal (1000). Use it to
 * confirm field names / behavior before the client's live terminal arrives.
 *
 * Test card:  4580000000000000  · exp 12/30 · CVV 123 · ID 123456789
 *
 * Usage:
 *   node scripts/cardcom-sandbox.mjs create [amount] [--invoice] [--payments N] [--iframe]
 *       -> creates a LowProfile page, prints the Url to pay on + the LowProfileId
 *   node scripts/cardcom-sandbox.mjs result <LowProfileId>
 *       -> calls GetLpResult and prints the parsed transaction (run AFTER paying)
 *   node scripts/cardcom-sandbox.mjs refund <TransactionId> [amount]
 *       -> refunds (full, or partial if amount given)
 *
 * Override creds with env: CARDCOM_TERMINAL, CARDCOM_API_NAME, CARDCOM_API_PASSWORD.
 */

const API_BASE = "https://secure.cardcom.solutions/api/v11";

const TERMINAL = Number(process.env.CARDCOM_TERMINAL || 1000);
const API_NAME = process.env.CARDCOM_API_NAME || "kzFKfohEvL6AOF8aMEJz";
const API_PASSWORD = process.env.CARDCOM_API_PASSWORD || "FIDHIh4pAadw3Slbdsjg";

const AUTH = { TerminalNumber: TERMINAL, ApiName: API_NAME, ApiPassword: API_PASSWORD };

async function post(endpoint, body) {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    console.error(`\nHTTP ${res.status} non-JSON:\n${text.slice(0, 800)}`);
    process.exit(1);
  }
  return { httpStatus: res.status, json };
}

function flag(name) {
  return process.argv.includes(`--${name}`);
}
function opt(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

async function create() {
  const amount = Number(process.argv[3] && !process.argv[3].startsWith("--") ? process.argv[3] : 5);
  const ref = `SBX-${Date.now()}`;
  const payments = Number(opt("payments", 1));

  const body = {
    ...AUTH,
    ReturnValue: ref,
    Amount: amount,
    ISOCoinId: 1,
    Language: "he",
    Operation: "ChargeOnly",
    ProductName: `Sandbox order ${ref}`,
    SuccessRedirectUrl: "https://example.com/success",
    FailedRedirectUrl: "https://example.com/failed",
    WebHookUrl: "https://example.com/webhook",
  };
  if (payments >= 2) {
    body.AdvancedDefinition = { MinNumOfPayments: 1, MaxNumOfPayments: Math.min(payments, 12) };
  }
  if (flag("invoice")) {
    body.Document = {
      Name: "Sandbox Customer",
      To: "Sandbox Customer",
      Email: opt("email", ""),
      DocumentTypeToCreate: opt("doctype", "Order"),
      Products: [{ Description: `Sandbox order ${ref}`, Quantity: 1, UnitCost: amount }],
    };
  }

  console.log(`\n> POST /LowProfile/Create  (terminal ${TERMINAL}, amount ₪${amount}, ref ${ref})`);
  const { httpStatus, json } = await post("/LowProfile/Create", body);
  console.log(`HTTP ${httpStatus}  ResponseCode=${json.ResponseCode}  ${json.Description ?? ""}`);
  console.log(JSON.stringify(json, null, 2));
  if (json.ResponseCode === 0 && json.Url) {
    console.log(`\n✓ Open this URL and pay with the test card:\n  ${json.Url}`);
    console.log(`\n  Then run:\n  node scripts/cardcom-sandbox.mjs result ${json.LowProfileId}\n`);
  } else {
    console.log("\n✗ Create failed - inspect the response above.\n");
  }
}

async function result() {
  const lpId = process.argv[3];
  if (!lpId) return console.error("Missing <LowProfileId>");
  console.log(`\n> POST /LowProfile/GetLpResult  (${lpId})`);
  const { httpStatus, json } = await post("/LowProfile/GetLpResult", { ...AUTH, LowProfileId: lpId });
  console.log(`HTTP ${httpStatus}  ResponseCode=${json.ResponseCode}  ${json.Description ?? ""}`);
  console.log(JSON.stringify(json, null, 2));

  const txn = json.TranzactionInfo ?? {};
  const ok = json.ResponseCode === 0 && (txn.ResponseCode === undefined || txn.ResponseCode === 0) && !!txn.TranzactionId;
  console.log("\n--- as the provider would parse it ---");
  console.log({
    success: ok,
    providerTransactionId: txn.TranzactionId ? String(txn.TranzactionId) : "",
    amount: Number(txn.Amount) || 0,
    orderReference: json.ReturnValue,
    approvalNumber: txn.ApprovalNumber,
    cardLast4: txn.Last4,
    token: txn.Token || json.TokenInfo?.Token,
    invoiceNumber: json.DocumentInfo?.DocumentNumber,
    invoiceUrl: json.DocumentInfo?.DocumentUrl,
  });
  if (ok) {
    console.log(`\n  To test a refund:\n  node scripts/cardcom-sandbox.mjs refund ${txn.TranzactionId}\n`);
  }
}

async function refund() {
  const txnId = Number(process.argv[3]);
  if (!txnId) return console.error("Missing <TransactionId>");
  const amount = process.argv[4] ? Number(process.argv[4]) : undefined;
  const body = { ...AUTH, TransactionId: txnId };
  if (amount !== undefined) body.PartialSum = amount;
  console.log(`\n> POST /Transactions/RefundByTransactionId  (txn ${txnId}${amount ? `, ₪${amount}` : ", full"})`);
  const { httpStatus, json } = await post("/Transactions/RefundByTransactionId", body);
  console.log(`HTTP ${httpStatus}  ResponseCode=${json.ResponseCode}  ${json.Description ?? ""}`);
  console.log(JSON.stringify(json, null, 2));
}

const cmd = process.argv[2];
const map = { create, result, refund };
if (!map[cmd]) {
  console.log("Usage: node scripts/cardcom-sandbox.mjs <create|result|refund> ...");
  console.log("  create [amount] [--invoice] [--payments N] [--email x] [--doctype Order]");
  console.log("  result <LowProfileId>");
  console.log("  refund <TransactionId> [amount]");
  process.exit(1);
}
map[cmd]().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
