import React from "react";
import LegalPage from "@/components/public/LegalPage";

const FALLBACK = `Effective date: 28 July 2026

This Privacy Policy explains how Rugby League Takeover ("RLT", "we", "us") handles personal information when you use our website or app, create an account, join the fan community, register interest in travel or events, view advertising, or buy merchandise.

[Information we collect]
We may collect your name, email address, phone number, postcode, city, country, profile biography, avatar, supported team and communication preferences. For merchandise orders we collect contact, delivery and order details. Stripe processes card details; RLT does not receive or store your full card number.
We collect content and activity you choose to contribute, including forum posts, replies, reactions, reports, images, tips, badges and reward activity. Public forum content, display name and any profile fields you choose to show can be seen by other users.
We also collect limited device and usage information needed to operate and protect the service, such as IP address, browser or app information, timestamps, diagnostic logs, ad impressions and clicks, and security or moderation signals. The website or app may use cookies, local storage and similar technology for sessions, preferences, carts, saved content, analytics and fraud prevention.

[How we collect and use information]
We collect information directly from you, automatically when you use the service, and from providers involved in authentication, payments or service delivery. We use it to create and secure accounts; provide community, store and event features; process, fulfil, support and refund orders; respond to enquiries; moderate content; prevent abuse and fraud; measure and improve the service and advertising; meet legal obligations; and send marketing only where permitted or where you have opted in.

[Service providers and disclosure]
We disclose only what is reasonably needed to providers that help us operate the service, including Supabase for authentication, database and storage; Vercel for hosting and delivery; Stripe for payments and fraud controls; email and notification providers; shipping or fulfilment providers; analytics and advertising providers; and travel, ticketing, event or accommodation providers when you choose to enquire or transact with them. We may also disclose information where required by law, to protect users or the service, or as part of a business transfer.
Some providers process information outside Australia, including in the United States and other locations where those providers or their subcontractors operate. Their privacy terms and security controls also apply to their processing.

[Advertising and analytics]
The service may show sponsor or third-party advertising. We may record that an ad was displayed or selected, together with limited device, page and timing data, to measure delivery and prevent abuse. Advertisers do not receive your full account profile from us unless you separately choose to provide information to them.

[Marketing and notifications]
You can opt out of marketing email using an unsubscribe link or by contacting us. Transactional, security, moderation and account messages may still be sent when needed to provide the service. Native push notifications may be offered when delivery is available; they require device permission and can be disabled in your device settings.

[Retention and account deletion]
We keep personal information only for as long as reasonably needed for the purposes above, dispute handling, fraud prevention and legal obligations. You can use /delete-account while signed in to delete your login and associated app data. Forum content is removed or de-identified. Some completed order, payment, refund, tax or fraud records may be retained and detached from your app account where reasonably required by law or legitimate record-keeping needs. Backup copies may persist temporarily until normal backup rotation completes.

[Access, correction and complaints]
You can update many profile details in your account. To request access to or correction of other personal information, or to make a privacy complaint, email support@rugbyleaguetakeover.com with enough information for us to verify and respond to your request. We will investigate and respond within a reasonable period. If you are not satisfied, you may contact the Office of the Australian Information Commissioner.

[Security and children]
We use reasonable technical and organisational safeguards, but no online service can guarantee absolute security. Keep your password and device secure and contact us if you suspect unauthorised access.
The service is intended for people aged 18 and over. We do not knowingly seek personal information from children.

[Changes and contact]
We may update this policy when the service or legal requirements change. The current version and effective date will remain available on this page.
Privacy questions, requests and complaints can be sent to support@rugbyleaguetakeover.com.`;

export default function Privacy() {
  return <LegalPage settingsKey="legal_privacy" title="Privacy Policy" fallback={FALLBACK} />;
}
