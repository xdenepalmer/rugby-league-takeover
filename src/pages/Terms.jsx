import React from "react";
import LegalPage from "@/components/public/LegalPage";

const FALLBACK = `Effective date: 28 July 2026

These Terms & Conditions govern your use of the Rugby League Takeover ("RLT", "we", "us") website, app, fan community, merchandise store, promotions and travel-interest features. By using the service, you agree to these terms.

[Eligibility and accounts]
The service is intended for people aged 18 and over. You must provide accurate information, keep your login secure, and promptly tell us if you suspect unauthorised access. You are responsible for activity under your account. You must not create accounts to evade a suspension, manipulate promotions or rewards, or interfere with the service.

[Community rules and user content]
You keep ownership of content you submit. You give RLT a non-exclusive, worldwide, royalty-free licence to host, store, reproduce, display and distribute that content only as reasonably needed to operate, promote and improve the service.

You must not post unlawful, threatening, abusive, discriminatory, deceptive, privacy-invasive or infringing content; impersonate others; publish another person's private information without permission; spam; upload malicious code; or manipulate votes, reactions, tips, contests or rewards. We may review, restrict, hide or remove content and may warn, suspend or close accounts where reasonably needed to enforce these terms, comply with law or protect the community. Please report concerning content through the available moderation tools.

[Merchandise, pricing and payment]
Store prices are in Australian dollars. Shipping within Australia is a flat $15 per order and is free when the merchandise subtotal after discounts is $150 or more. Stripe securely processes payment. An order is accepted when payment is confirmed and RLT issues the order confirmation.

Stock is subject to availability. If an item becomes unavailable after payment, we will contact you and provide an appropriate replacement, credit or refund. Product colours and appearance may vary slightly by screen. Delivery timeframes are estimates and may be affected by carriers or events outside our reasonable control. You must provide a complete and accurate delivery address.

[Returns and consumer guarantees]
For a change of mind, contact support@rugbyleaguetakeover.com within 30 days after delivery. The item must be unworn, unused and in its original condition. Contact us before sending anything back so we can provide return instructions. Change-of-mind returns may exclude personalised or final-sale items where this was clearly stated before purchase.

Our goods come with guarantees that cannot be excluded under the Australian Consumer Law. If a product is faulty, unsafe, not as described or otherwise fails a consumer guarantee, you may be entitled to a repair, replacement, refund or other remedy depending on the circumstances. Nothing in these terms limits those rights.

[Travel, accommodation and ticket links]
RLT may publish offers, collect expressions of interest, or link to travel, accommodation, ticket and event providers. Unless expressly stated at checkout, RLT is not the travel agent, accommodation provider, ticket issuer or event organiser. A booking made with a third party is between you and that provider and is subject to its price, availability, booking, cancellation, refund and privacy terms. Check those terms before booking.

[Advertising and sponsors]
The service displays advertising and sponsored content. Paid or sponsored placements do not mean RLT guarantees or endorses a product, service, event or provider. Interactions or purchases with an advertiser are between you and that advertiser, subject to applicable consumer law.

[Games, tipping, badges and rewards]
Tipping, badges, points, chips, streaks, leaderboards and similar features are for entertainment and community participation. They have no cash value, cannot be transferred or redeemed for money, and are not gambling products or promises of a prize. We may correct errors, reverse manipulation, reset balances or change or retire these features where reasonably necessary.

[Intellectual property]
Except for user content, material on the service—including RLT branding, graphics, software, layout and original editorial content—is owned by or licensed to RLT. You may use it for personal, non-commercial use of the service, but must not copy, sell, modify or commercially exploit it without permission or another legal right.

[Availability and acceptable use]
We may maintain, update or discontinue features and cannot promise uninterrupted or error-free access. You must not probe security, scrape the service at unreasonable volume, bypass access controls, introduce malware, reverse engineer protected parts of the service, or use it in a way that harms RLT, providers or other users.

[Suspension and termination]
You may stop using the service and request account deletion at any time. We may restrict, suspend or terminate access for a serious or repeated breach, security risk, legal requirement or harm to others. Provisions intended to continue—such as intellectual property, completed transactions, disclaimers and liability terms—survive termination.

[Liability]
Nothing in these terms excludes, restricts or modifies a consumer guarantee, right or remedy that cannot lawfully be excluded. To the extent permitted by law, RLT is not responsible for indirect or consequential loss, third-party services, user content, or events outside our reasonable control. Where liability can lawfully be limited, it is limited to the remedy required by applicable law.

[Changes to these terms]
We may update these terms to reflect changes to the service or law. Material changes will be posted with a new effective date. Changes do not alter an order already accepted unless required by law or agreed with you.

[Contact]
Questions about these terms, store orders or returns can be sent to support@rugbyleaguetakeover.com.`;

export default function Terms() {
  return <LegalPage settingsKey="legal_terms" title="Terms & Conditions" fallback={FALLBACK} />;
}
