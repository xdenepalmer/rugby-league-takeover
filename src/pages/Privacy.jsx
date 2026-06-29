import React from "react";
import LegalPage from "@/components/public/LegalPage";

const FALLBACK = `This Privacy Policy explains how Rugby League Takeover ("RLT", "we", "us") collects, uses and protects your personal information when you use this website, register your travel interest, shop in our store, or take part in the fan forum. Please review it with your own legal advisor before relying on it.

[Information we collect]
We collect information you provide directly: your name, email, phone, postcode and travel preferences when you register interest; account and profile details when you create an account; order and shipping details when you purchase merchandise; and content you post in the forum. We also collect limited technical information (such as your IP address) for security, moderation and fraud prevention.

[How we use your information]
We use your information to respond to travel-interest enquiries, process and ship orders, operate and moderate the forum, send you updates you have opted into, and keep the site secure. We do not sell your personal information.

[Payments]
Card payments are processed securely by our payment provider (Stripe). We do not store your full card details on our servers.

[Sharing]
We share information only as needed to run the service — for example with our payment provider, shipping partners, and the third-party travel/accommodation providers you choose to book with — or where required by law.

[Marketing]
We only send marketing communications where you have opted in. You can unsubscribe at any time using the link in our emails or by contacting us.

[Your rights]
You may request access to, correction of, or deletion of your personal information, subject to legal requirements. Contact us using the details below.

[Data retention & security]
We retain personal information only as long as needed for the purposes above or as required by law, and we take reasonable steps to protect it from misuse, loss and unauthorised access.

[Contact]
Privacy questions and requests can be sent to support@rugbyleaguetakeover.com.

Last updated: this is placeholder content — replace it in the admin panel with your finalised, legally reviewed Privacy Policy.`;

export default function Privacy() {
  return <LegalPage settingsKey="legal_privacy" title="Privacy Policy" fallback={FALLBACK} />;
}
