import React from "react";
import LegalPage from "@/components/public/LegalPage";

// Fallback content mirrors how the shop actually works: AusPost domestic
// shipping quoted live at checkout, free over the configured threshold, and
// collection at the Las Vegas event for overseas supporters. An admin can
// replace all of it from Site Settings → Legal pages.
const FALLBACK = `Effective date: 6 August 2026

This policy covers delivery of merchandise ordered from the Rugby League Takeover ("RLT") store.

[Where we ship]
We ship physical merchandise within Australia using Australia Post. We do not post internationally. Supporters ordering from outside Australia choose "Collect in Las Vegas" at checkout and pick their order up at the event instead — see Collection below.

[Shipping cost]
Shipping is calculated at checkout from your postcode and the weight of your order, using live Australia Post rates. You choose between standard (Parcel Post) and faster (Express Post) options where available; the exact price is shown before you pay. Orders over the free-shipping threshold shown in the store ship free within Australia.

[Dispatch and delivery times]
Orders are dispatched from Queensland, normally within 2-4 business days of payment. Delivery times after dispatch are Australia Post's estimates shown at checkout (typically 2-6 business days depending on service and destination) and are not guaranteed by RLT. You will receive a confirmation email when your order is placed, and tracking details when it ships.

[Collection in Las Vegas (international orders)]
International orders are collected in person at the Rugby League Takeover event in Las Vegas. After payment you receive a collection pass with a unique code (you can also add it to your phone's wallet). Bring the pass and photo ID to the RLT stand at the event; each pass can be collected once. Orders not collected at the event will be dealt with case by case — contact us at admin@rugbyleaguetakeover.com.

[Wrong address or failed delivery]
Please check your delivery address carefully at checkout. If a parcel is returned to us because the address supplied was incorrect or the parcel went unclaimed, we will contact you; re-delivery may require payment of a further postage charge.

[Damaged or lost in transit]
If your order arrives damaged or does not arrive within a reasonable time of the estimate, contact admin@rugbyleaguetakeover.com with your order number and we will put it right — see our Refunds & Exchanges policy. Nothing in this policy limits your rights under the Australian Consumer Law.`;

export default function Shipping() {
  return <LegalPage settingsKey="legal_shipping" title="Shipping Policy" fallback={FALLBACK} />;
}
