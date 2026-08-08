import React from "react";
import LegalPage from "@/components/public/LegalPage";

// Fallback content mirrors what the store actually supports: full and partial
// refunds processed back through Stripe, cancellation before dispatch, and
// exchanges arranged through support. Consumer-guarantee language follows the
// Australian Consumer Law — those rights cannot be excluded and this policy
// does not attempt to. Admin-replaceable from Site Settings → Legal pages.
const FALLBACK = `Effective date: 6 August 2026

This policy covers refunds, exchanges and cancellations for merchandise bought from the Rugby League Takeover ("RLT") store. It applies in addition to your rights under the Australian Consumer Law, which cannot be excluded.

[Faulty, damaged or not as described]
If an item arrives faulty, damaged, or is not what you ordered, we will make it right at no cost to you: a replacement, a repair, or a full refund including any postage you paid, as the Australian Consumer Law requires. Email admin@rugbyleaguetakeover.com with your order number and a photo of the problem and we will sort it quickly.

[Change of mind]
We want you happy in your gear. If you change your mind, contact us within 30 days of delivery (or collection at the event). Items must be unworn, unwashed and in original condition with tags. Return postage for change-of-mind returns is at your cost, and the refund covers the item price (original outbound postage is not refunded). We may decline change-of-mind returns on clearance items where that was stated at purchase.

[Exchanges (sizes)]
Wrong size? Email admin@rugbyleaguetakeover.com and we will arrange an exchange subject to stock. Post the original back unworn with tags and we will send the new size; where stock has run out we will refund instead.

[Cancelling an order]
You can cancel for a full refund any time before your order is dispatched — email us as soon as possible with your order number. Once an order has shipped, the change-of-mind process above applies instead.

[How refunds are paid]
Refunds are processed to the original payment method through Stripe, and can be full or partial (for example where only one item in an order is affected). Refunds normally appear on your statement within 5-10 business days of being processed. We will confirm by email when a refund has been issued.

[Event collection orders]
Orders for collection in Las Vegas can be cancelled for a full refund before the event. Items collected at the event can still be returned under this policy — postage back to Australia for change-of-mind returns is at your cost; faulty items will be handled at ours.

[Contact]
admin@rugbyleaguetakeover.com — include your order number in every message and we will look after you.`;

export default function Refunds() {
  return <LegalPage settingsKey="legal_refunds" title="Refunds & Exchanges" fallback={FALLBACK} />;
}
