# Compliance & Accessibility Posture

Honest statement of where Rugby League Takeover stands on accessibility and
security compliance, what is implemented in this codebase, and what would
require organisational work beyond code. Last reviewed: July 2026.

---

## Accessibility (WCAG 2.1 AA)

### Implemented in this codebase

| Measure | WCAG criterion | Where |
| --- | --- | --- |
| `lang="en"` on the document | 3.1.1 Language of Page | `index.html` |
| Zoom not disabled (no `user-scalable=no` / `maximum-scale`) | 1.4.4 Resize Text | `index.html` viewport meta |
| Skip-to-content link (visible on keyboard focus) | 2.4.1 Bypass Blocks | `PublicLayout.jsx` |
| Pause/play control on the auto-playing background video, persisted across pages/visits | 2.2.2 Pause, Stop, Hide | `BackgroundVideo.jsx` |
| Background video suppressed under `prefers-reduced-motion` and data-saver | 2.3.3 Animation from Interactions (AAA, met anyway) | `BackgroundVideo.jsx` |
| Global CSS animation/transition kill-switch under `prefers-reduced-motion` | 2.3.3 | `src/index.css` |
| Alt text on informative images; empty alt on decorative ones; video layer `aria-hidden` | 1.1.1 Non-text Content | site-wide |
| Icon-only buttons carry `aria-label`s (cart, quantity, lightbox, dialogs) | 4.1.2 Name, Role, Value | site-wide |
| Form inputs associated with labels (visible or `sr-only`) | 1.3.1 / 3.3.2 | Store checkout, forum compose, admin |
| `focus-visible` styling; dialogs marked `role="dialog"` / `aria-modal` | 2.4.7 Focus Visible | `index.css`, overlays |
| Touch targets ≥ 44px on primary interactive controls | 2.5.8 Target Size (2.2) | site-wide (`touch-target`, `min-h-[44px]`) |
| Status/error messages use `role="alert"` / `role="status"` + `aria-live` | 4.1.3 Status Messages | checkout, forms |

### Known limitations (not yet verified/fixed)

- **Colour contrast** has not been instrument-audited. The design uses small,
  low-contrast, uppercase micro-labels (e.g. `text-muted-foreground/30` at
  8–10px) in several places that likely fail 1.4.3 (AA, 4.5:1). An audit with
  axe/Lighthouse against the live site, and a pass over the worst offenders,
  is the highest-value next step.
- **Focus trapping** in custom modals (cart drawer, quick-view, lightbox) has
  not been verified — Radix-based dialogs handle this; hand-rolled overlays
  may not.
- Screen-reader walkthrough (VoiceOver/NVDA) has not been performed.
- Accessibility conformance can only be *claimed* after testing against the
  rendered site; this repo implements the mechanics but no formal audit
  (e.g. against WCAG-EM) has been run.

---

## Security controls (ISO 27001 / SOC 2 alignment)

**Plain truth:** ISO 27001 certification and a SOC 2 report are organisational
attestations — audited policies, risk registers, personnel processes, and (for
SOC 2) an independent auditor observing controls over time. **No code change
makes a website "ISO 27001 certified" or "SOC 2 compliant."** What a codebase
can do is implement the *technical controls* those frameworks expect. Status:

### Technical controls implemented

- **Access control / least privilege** (ISO A.9, SOC 2 CC6):
  Postgres Row-Level Security on every table; field-level privacy via
  sanitising views (visitor IPs and linked emails are admin-only); admin-only
  Edge Function endpoints verify the caller's role server-side; storage
  bucket listing restricted to admins; private `labels` bucket with
  admin-only signed URLs (1-hour expiry).
- **Secrets management** (A.9.4 / CC6.1): all credentials (Stripe, AusPost,
  Resend, service-role key) live in Supabase Edge Function secrets — never in
  the repo, frontend bundle, or client env vars. The publishable Supabase
  anon key is the only key shipped to browsers, by design.
- **Transport security** (A.13 / CC6.7): HTTPS everywhere (Vercel-managed
  TLS), HSTS (2 years, includeSubDomains), `upgrade-insecure-requests`.
- **Hardened HTTP headers** (`vercel.json`): Content-Security-Policy with
  `script-src 'self'` (no inline/third-party script execution),
  `frame-ancestors 'self'` + X-Frame-Options (clickjacking),
  X-Content-Type-Options nosniff, Referrer-Policy, Permissions-Policy
  (camera/mic/geolocation/payment disabled).
- **Payment integrity** (CC6/CC7): Stripe webhook signature verification;
  order/session cross-checks (amount, currency, app id, order id);
  idempotent webhook handling; server-side price computation (client never
  sets prices); no card data ever touches this system (Stripe-hosted
  checkout — PCI DSS burden sits with Stripe).
- **Input handling**: server-side validation on all public form endpoints,
  bot honeypots, ban list (IP/email/user), profanity filtering, markdown
  rendered via React elements (no `innerHTML` for user content).
- **Auditability** (A.12.4 / CC7): order timeline records every status
  change with actor and timestamp; Supabase provides database/auth logs;
  GitHub history (PR-reviewed) is the change-management record.
- **Availability** (A.17 / SOC 2 Availability): Supabase automated backups;
  static frontend on Vercel's CDN; service worker offline fallback.

### Inherited from subprocessors

The infrastructure providers hold their own certifications, which cover the
physical/platform layers this app runs on (verify current status on their
trust pages before relying on this in a contract):

| Provider | Role | Attestations (as published by provider) |
| --- | --- | --- |
| Supabase | Database, auth, storage, functions | SOC 2 Type II; HIPAA add-on available on paid plans |
| Vercel | Frontend hosting/CDN | SOC 2 Type II, ISO 27001 |
| Stripe | Payments | PCI DSS Level 1, SOC 1/2, ISO 27001 |
| GitHub | Source control | SOC 1/2, ISO 27001 |

### What certification would additionally require (organisational, not code)

Information-security policy and risk register; access-review and offboarding
process; incident-response and breach-notification procedure; vendor
management; business-continuity testing; security-awareness training; and an
accredited external auditor (certification body for ISO 27001; CPA firm for
SOC 2, typically observing 3–12 months). If RLT ever needs a SOC 2 report
(e.g. a sponsor's procurement asks for one), a compliance-automation platform
(Vanta/Drata/Secureframe) is the usual starting point.

---

## HIPAA — not applicable

HIPAA governs *protected health information* handled by US healthcare covered
entities and their business associates. This platform is a sports supporter
community and merch store: it collects account emails, forum posts, orders,
and shipping addresses — **no health information, and no relationship with
any covered entity**. HIPAA compliance is therefore not applicable, and
pursuing it (BAA agreements, dedicated hosting tiers) would add cost and
complexity for zero benefit. If that ever changes (it shouldn't), Supabase
offers a HIPAA add-on with a BAA as the starting point.

## Privacy note (what actually applies)

The applicable privacy regime for RLT is the **Australian Privacy Act (APPs)**
— and GDPR to the extent EU/UK fans sign up. The site ships a privacy policy
page (`/privacy`, editable in admin Site Settings); keeping it accurate about
what is collected (emails, orders, shipping addresses, forum content, IPs for
moderation) is the ongoing obligation that matters most in practice.
