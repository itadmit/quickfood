# Infra config

External-service configuration that has to live somewhere outside the app
code. Apply once per environment.

## Cloudflare R2 — CORS

The image upload flow PUTs files directly from the browser to a presigned R2
URL (see [`app/api/v1/upload/init/route.ts`](../app/api/v1/upload/init/route.ts)
and [`lib/storage/r2.ts`](../lib/storage/r2.ts)). R2 enforces CORS on
presigned PUTs, so the bucket needs a policy listing every origin we serve
the dashboard from.

Symptom of the missing policy:

```
Access to fetch at 'https://<account>.r2.cloudflarestorage.com/...'
from origin 'https://quickfoodil.vercel.app' has been blocked by CORS policy:
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

### Apply via Cloudflare dashboard

1. https://dash.cloudflare.com → **R2** → bucket `quickfood`
2. **Settings** → **CORS Policy** → **Add CORS Policy**
3. Paste the contents of [`r2-cors.json`](./r2-cors.json) and save.

### Apply via Wrangler CLI

```bash
npm i -g wrangler
wrangler login
wrangler r2 bucket cors put quickfood --file infra/r2-cors.json
```

### Verify

```bash
curl -X OPTIONS 'https://<account>.r2.cloudflarestorage.com/quickfood/probe.jpg' \
  -H 'Origin: https://quickfoodil.vercel.app' \
  -H 'Access-Control-Request-Method: PUT' \
  -I
```

Expect `Access-Control-Allow-Origin: https://quickfoodil.vercel.app` in
the response headers.

### When to update

Add a new origin to `r2-cors.json` whenever:
- A new production domain is added (e.g., `quickfood.app`).
- A merchant's custom domain starts uploading directly (rare — most merchants
  upload through the same dashboard URL).
- A different preview / staging environment needs to upload (covered today
  by the `https://*.vercel.app` wildcard).

Then re-apply the policy via either method above.
