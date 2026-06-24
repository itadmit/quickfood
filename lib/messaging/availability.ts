/**
 * Single source of truth for "can this tenant send on channel X right now".
 *
 * SMS and BYO-WhatsApp keep SEPARATE credit pools. The managed track
 * (`whatsapp_managed`) draws no credits and is gated only by an active
 * subscription. The BYO WhatsApp connection is gated by `whatsappEnabled`
 * (a durable "bought a package" latch) so it never re-locks at zero balance.
 *
 * The platform iBot default number is reserved for the managed track only,
 * so `whatsappConnected` reflects the tenant's OWN creds - there is no
 * platform-default fall-through for BYO.
 */
export interface MessagingAvailabilityInput {
  smsCreditsRemaining: number;
  whatsappCreditsRemaining: number;
  whatsappEnabled: boolean;
  whatsappToken: string | null;
  whatsappInstanceId: string | null;
  reviewsWhatsappSubscriptionId: string | null;
}

export interface MessagingAvailability {
  smsAvailable: boolean;
  whatsappEnabled: boolean;
  whatsappConnected: boolean;
  whatsappAvailable: boolean;
  managedActive: boolean;
  smsCredits: number;
  whatsappCredits: number;
}

export function resolveMessagingAvailability(
  t: MessagingAvailabilityInput,
): MessagingAvailability {
  const whatsappConnected = !!(t.whatsappToken && t.whatsappInstanceId);
  return {
    smsAvailable: t.smsCreditsRemaining > 0,
    whatsappEnabled: t.whatsappEnabled,
    whatsappConnected,
    whatsappAvailable:
      t.whatsappEnabled && whatsappConnected && t.whatsappCreditsRemaining > 0,
    managedActive: !!t.reviewsWhatsappSubscriptionId,
    smsCredits: t.smsCreditsRemaining,
    whatsappCredits: t.whatsappCreditsRemaining,
  };
}
