import { handler, apiJson, apiError } from "@/lib/api-response";
import { initiateKioskCheckoutPayment } from "@/lib/payments/initiate-kiosk-checkout-payment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handler(
  async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const result = await initiateKioskCheckoutPayment(id);
    if (!result.ok) {
      return apiError(result.code, result.message, result.status);
    }
    return apiJson(result.data);
  },
);
