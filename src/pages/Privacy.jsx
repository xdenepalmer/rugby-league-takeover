import React from "react";
import LegalPage from "@/components/public/LegalPage";

const FALLBACK = `Effective date: 28 July 2026

This Privacy Policy explains how Rugby League Takeover ("RLT", "we", "us") handles personal information when you use our website or app, create an account, join the fan community, register travel interest, view advertising, or buy merchandise.

[Information we collect]
We may collect your email address, display name, profile details and account identifiers; forum posts, comments, reactions, images and moderation reports; merchandise order, delivery and contact details; travel-interest details such as your name, phone number, postcode and preferences; marketing choices; and messages you send us.

We also collect information needed to operate and protect the service, including IP address, device and browser information, app activity, login and security events, and advertising impressions or clicks. Cookies, local storage and similar technologies may keep you signed in, remember settings and cart contents, measure service performance, and support advertising measurement.

[How we collect and use information]
We collect information from you, from your use of the service, and from service providers that help us operate it. We use it to provide accounts and community features, moderate content, process and fulfil orders, respond to enquiries, record travel interest, show and measure advertising, prevent fraud and abuse, improve the service, comply with law, and send marketing only where permitted or requested.

[Public community content]
Forum posts, comments, profile display names, images, reactions and related activity may be visible to other users or the public. Do not post personal information that you do not want others to see. We may review and moderate community content to enforce our rules and protect users.

[Payments and orders]
Stripe processes card payments. RLT receives payment status and limited transaction details, but does not receive or store your full card number. We share the delivery and contact information needed to fulfil an order with delivery and fulfilment providers.

[Service providers and disclosure]
We use service providers including Supabase for authentication, databases and storage; Vercel for website hosting and delivery; Stripe for payments; and email, analytics, advertising, security, shipping or fulfilment providers where needed. If you choose a third-party travel, accommodation or ticket offer, information you submit to that provider is handled under its own privacy policy.

We may also disclose information where required or authorised by law, to investigate misuse or protect rights and safety, or as part of a business transfer. We do not sell personal information.

[Overseas processing]
Some service providers may process or store information outside Australia, including in countries where they or their infrastructure operate. Privacy protections in those countries may differ from Australia. We take reasonable steps when selecting and using providers that handle personal information.

[Marketing, advertising and choices]
You can unsubscribe from marketing emails using the link in the message or by contacting us. You can control cookies and similar storage through your browser or device, although disabling them may affect sign-in, cart and other features. Advertising providers may use device or activity information to deliver or measure ads subject to their own settings and policies.

[Access, correction and deletion]
You may ask to access or correct personal information we hold about you. You can request account deletion through the Delete Account page at /delete-account or contact us. We may need to verify your identity. Some records may be retained or de-identified where reasonably needed for fraud prevention, disputes, order records, legal obligations or enforcement.

[Retention and security]
We keep information only for as long as reasonably needed for the purposes described above, including providing the service, maintaining order and financial records, resolving disputes and meeting legal obligations. Retention periods vary by the type of information. We use reasonable technical and organisational safeguards, but no internet service can guarantee absolute security.

[Age]
RLT is intended for people aged 18 and over. We do not knowingly seek personal information from children. If you believe a child has provided personal information, contact us so we can investigate and take appropriate action.

[Privacy questions and complaints]
To request access or correction, ask a privacy question, or make a complaint, email support@rugbyleaguetakeover.com. Describe your concern and how we can contact you. We will review it and respond within a reasonable time. If you are not satisfied, you may contact the Office of the Australian Information Commissioner.

[Changes]
We may update this policy when our practices or legal obligations change. The effective date above shows when this version applies.`;

export default function Privacy() {
  return <LegalPage settingsKey="legal_privacy" title="Privacy Policy" fallback={FALLBACK} />;
}
