export const GROW_SIGNUP_URL = "/connect-payment";

const AIRTABLE_ORIGIN = "https://airtable.com";
const APP_ID = "appDxqmg4PezmVLuY";
const SHARE_ID = "shrNuRrP6q7ls8Rfh";
const VIEW_ID = "viwh4mDLUO33iHy5r";
const PUBLIC_FORM_URL = `${AIRTABLE_ORIGIN}/${APP_ID}/${SHARE_ID}`;

const FIELD = {
  businessNumber: "fldT8uHda5yHCfZWd",
  businessName: "fldTnZby5bbG2m24q",
  phone: "fld8DonQ4BHhIr7WV",
  website: "fldL3mG3kTtAecSvQ",
  marketer: "fldhCins4CT6P1IC1",
  package: "fldsczETiV9BUEIsw",
} as const;

const MARKETER_OPTION = "sel5CduqxmBVD9dAy";
const PACKAGE_RECORD = {
  foreignRowId: "recJQ2riqQm66yoTa",
  foreignRowDisplayName: "1% קוויק שופ",
};

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

const ALPHANUM = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

function randId(prefix: string, len: number): string {
  let s = "";
  for (let i = 0; i < len; i++) s += ALPHANUM[Math.floor(Math.random() * ALPHANUM.length)];
  return prefix + s;
}

function mergeCookies(jar: Map<string, string>, setCookies: string[]): void {
  for (const sc of setCookies) {
    const pair = sc.split(";", 1)[0];
    const eq = pair.indexOf("=");
    if (eq > 0) jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
  }
}

function cookieHeader(jar: Map<string, string>): string {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

function baseHeaders(csrf: string, jar: Map<string, string>): Record<string, string> {
  return {
    "user-agent": UA,
    accept: "application/json, text/javascript, */*; q=0.01",
    "x-requested-with": "XMLHttpRequest",
    "x-airtable-application-id": APP_ID,
    "x-airtable-inter-service-client": "webClient",
    "x-csrf-token": csrf,
    "x-time-zone": "Asia/Jerusalem",
    "x-user-locale": "en",
    cookie: cookieHeader(jar),
  };
}

export interface GrowLeadInput {
  businessNumber: string;
  businessName: string;
  phone: string;
  website?: string;
}

export async function submitGrowLead(input: GrowLeadInput): Promise<string> {
  const jar = new Map<string, string>();

  const formRes = await fetch(PUBLIC_FORM_URL, {
    headers: { "user-agent": UA, accept: "text/html" },
    cache: "no-store",
  });
  mergeCookies(jar, formRes.headers.getSetCookie());
  const html = await formRes.text();

  const csrf = html.match(/"csrfToken":"([^"]+)"/)?.[1];
  const readPolRaw = html.match(/"accessPolicy":"(\{[\s\S]*?\})"/)?.[1];
  if (!csrf || !readPolRaw) {
    throw new Error("grow_form_bootstrap_failed");
  }
  const readPolicy = JSON.parse(JSON.parse(`"${readPolRaw}"`)) as unknown;

  const readUrl =
    `${AIRTABLE_ORIGIN}/v0.3/view/${VIEW_ID}/readSharedFormData` +
    `?stringifiedObjectParams=%7B%7D&requestId=${randId("req", 16)}` +
    `&accessPolicy=${encodeURIComponent(JSON.stringify(readPolicy))}`;
  const readRes = await fetch(readUrl, { headers: baseHeaders(csrf, jar), cache: "no-store" });
  mergeCookies(jar, readRes.headers.getSetCookie());
  const readJson = (await readRes.json()) as { data?: { accessPolicy?: string } };
  const submitPolicy = readJson.data?.accessPolicy;
  if (!submitPolicy) {
    throw new Error("grow_submit_policy_missing");
  }

  const cellValuesByColumnId: Record<string, unknown> = {
    [FIELD.businessNumber]: input.businessNumber,
    [FIELD.businessName]: input.businessName,
    [FIELD.phone]: input.phone,
    [FIELD.website]: input.website ?? "",
    [FIELD.marketer]: MARKETER_OPTION,
    [FIELD.package]: [PACKAGE_RECORD],
  };

  const body = new URLSearchParams({
    stringifiedObjectParams: JSON.stringify({ rowId: randId("rec", 14), cellValuesByColumnId }),
    requestId: randId("req", 13),
    accessPolicy: submitPolicy,
    _csrf: csrf,
  });

  const submitRes = await fetch(`${AIRTABLE_ORIGIN}/v0.3/view/${VIEW_ID}/submitSharedForm`, {
    method: "POST",
    headers: {
      ...baseHeaders(csrf, jar),
      "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
      origin: AIRTABLE_ORIGIN,
    },
    body: body.toString(),
    cache: "no-store",
  });
  const submitJson = (await submitRes.json()) as { msg?: string; data?: { rowId?: string } };
  if (submitJson.msg !== "SUCCESS" || !submitJson.data?.rowId) {
    throw new Error("grow_submit_failed");
  }
  return submitJson.data.rowId;
}
