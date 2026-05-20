import { apiJson } from "@/lib/api-response";

export const runtime = "nodejs";

/**
 * OpenAPI placeholder.
 *
 * MVP: a hand-rolled lightweight spec covering the core endpoints. We can swap in
 * full zod-to-openapi auto-gen as the API surface grows.
 */
export async function GET() {
  return apiJson({
    openapi: "3.1.0",
    info: {
      title: "QuickFood API",
      version: "1.0.0",
      description:
        "REST API לפלטפורמת QuickFood. כל endpoint מחזיר JSON. אימות דרך cookies/web, Bearer JWT/mobile, או API key/integrations.",
    },
    servers: [{ url: "/api/v1" }],
    paths: {
      "/health": {
        get: {
          summary: "Health check",
          responses: { "200": { description: "ok" } },
        },
      },
      "/auth/otp/request": {
        post: {
          summary: "Request a one-time code via SMS",
          requestBody: { required: true },
          responses: { "200": { description: "sent" } },
        },
      },
      "/auth/otp/verify": {
        post: {
          summary: "Verify code and create/login a customer session",
          requestBody: { required: true },
          responses: { "200": { description: "logged in" } },
        },
      },
      "/merchant/auth/login": {
        post: {
          summary: "Email+password login for merchant users",
          responses: { "200": { description: "logged in" } },
        },
      },
      "/restaurants/{slug}": {
        get: { summary: "Restaurant details by slug" },
      },
      "/restaurants/{slug}/menu": {
        get: { summary: "Full menu (categories + items + sizes + options)" },
      },
      "/merchant/orders": {
        get: { summary: "List orders for the authenticated tenant" },
      },
      "/merchant/orders/{id}/status": {
        patch: { summary: "Advance an order's status" },
      },
      "/merchant/webhooks/endpoints": {
        get: { summary: "List webhook endpoints" },
        post: { summary: "Create a webhook endpoint (returns secret once)" },
      },
      "/realtime/orders/{orderId}": {
        get: {
          summary: "SSE stream of order events (customer-facing)",
          responses: { "200": { description: "text/event-stream" } },
        },
      },
      "/realtime/merchant": {
        get: {
          summary: "SSE stream of tenant order events (merchant)",
          responses: { "200": { description: "text/event-stream" } },
        },
      },
    },
    components: {
      securitySchemes: {
        cookieAuth: { type: "apiKey", in: "cookie", name: "qf_access" },
        bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
        apiKeyAuth: { type: "http", scheme: "bearer", bearerFormat: "QF-API-KEY" },
      },
    },
    security: [{ cookieAuth: [] }, { bearerAuth: [] }, { apiKeyAuth: [] }],
  });
}
