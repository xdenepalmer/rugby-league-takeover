import React from "react";
import LegalPage from "@/components/public/LegalPage";

const FALLBACK = `Welcome to Rugby League Takeover ("RLT", "we", "us"). These Terms & Conditions govern your use of this website, our fan forum, merchandise store, and travel-interest registrations. By using the site you agree to these terms. Please review them with your own legal advisor before relying on them.

[Who we are]
Rugby League Takeover is a fan-run community organising supporter travel, events and merchandise around NRL Las Vegas. Travel packages are provided in partnership with third-party travel and accommodation providers; bookings made through external links are subject to those providers' own terms.

[Use of the site]
You agree to use this site lawfully and not to post unlawful, abusive, infringing or misleading content in the forum. We may moderate, hide, or remove content and suspend accounts that breach these terms. You are responsible for keeping your account details secure.

[Merchandise & orders]
Prices are shown in AUD and include applicable taxes where stated. Orders are confirmed once payment is processed. Availability is not guaranteed until your order is confirmed; if an item sells out we will contact you to arrange a refund or alternative. Shipping times are estimates. See our returns information for change-of-mind and faulty-item returns.

[Travel packages & bookings]
Travel and accommodation offers are facilitated through third-party providers and may be subject to availability, change, and the provider's own booking terms, deposit and cancellation policies. RLT is not the travel agent of record unless expressly stated and is not liable for the acts or omissions of third-party providers.

[Intellectual property]
All site content, branding, logos and designs are owned by or licensed to RLT and may not be reproduced without permission.

[Liability]
To the maximum extent permitted by law, RLT is not liable for indirect or consequential loss arising from use of the site. Nothing in these terms excludes rights you have under the Australian Consumer Law that cannot be excluded.

[Changes]
We may update these terms from time to time. Continued use of the site after changes are posted constitutes acceptance.

[Contact]
Questions about these terms can be sent to support@rugbyleaguetakeover.com.

Last updated: this is placeholder content — replace it in the admin panel with your finalised, legally reviewed Terms & Conditions.`;

export default function Terms() {
  return <LegalPage settingsKey="legal_terms" title="Terms & Conditions" fallback={FALLBACK} />;
}
