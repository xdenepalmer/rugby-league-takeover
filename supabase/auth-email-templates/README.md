# Branded auth emails via Resend — setup

Two things make Supabase stop sending its default plain emails:
**(1)** route auth email through Resend's SMTP, **(2)** paste these branded
templates over the defaults. Both are Supabase-dashboard-only settings (they
can't be set from code), so follow the steps below once.

App-sent emails (order confirmations, product release alerts) are separate —
they already go through the Resend API with the same branding, via
`sendBrandedEmail` in `supabase/functions/_shared/shared.ts`.

## 0. Verify the sending domain in Resend (do this first)

1. Resend dashboard → **Domains** → **Add Domain** → `rugbyleaguetakeover.com`.
2. Add the DNS records Resend shows (SPF + DKIM, usually 3 records) at your
   registrar, then wait for Resend to show **Verified**.
3. Until this is done, Resend will only deliver to your own inbox from
   `onboarding@resend.dev` — real customers won't get anything.

## 1. Point Supabase Auth at Resend SMTP

Supabase Dashboard → Project **RUGBY LEAGUE TAKEOVER** → **Authentication →
Emails → SMTP Settings** (older UI: Project Settings → Auth → SMTP) → enable
**Custom SMTP** and enter:

| Field | Value |
| --- | --- |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | your Resend API key (the same value as the `RESEND_API_KEY` secret) |
| Sender email | `no-reply@rugbyleaguetakeover.com` (must be on the verified domain) |
| Sender name | `Rugby League Takeover` |

## 2. Paste the branded templates

Dashboard → **Authentication → Emails → Templates**. For each template below,
replace the default body with the full contents of the matching file here
(and set the subject):

| Supabase template | File | Subject to set |
| --- | --- | --- |
| Confirm signup | `confirm-signup.html` | `Your Rugby League Takeover confirmation code` |
| Reset password | `reset-password.html` | `Reset your Rugby League Takeover password` |
| Magic link | `magic-link.html` | `Your Rugby League Takeover sign-in link` |
| Invite user | `invite.html` | `You're invited to Rugby League Takeover` |

Notes:
- **Confirm signup must keep `{{ .Token }}`** — the register page asks for the
  6-digit code, not a link. The template here already shows the code big and
  centred.
- The other templates use `{{ .ConfirmationURL }}` buttons.
- The logo is loaded from `{{ .SiteURL }}/icons/icon-192.png`, so set the
  Site URL correctly (next step) or the logo 404s.

## 3. URL configuration (also fixes the broken reset flow)

Dashboard → **Authentication → URL Configuration**:

- **Site URL**: `https://www.rugbyleaguetakeover.com`
- **Redirect URLs** — add all of:
  - `https://www.rugbyleaguetakeover.com/**`
  - `https://rugbyleaguetakeover.com/**`
  - `https://www.rugbyleaguetakeover.com.au/**`
  - `https://rugbyleaguetakeover.com.au/**`
  - `https://rugby-league-takeover.vercel.app/**`

Without the allow-list, Supabase ignores the app's `redirectTo` and drops
users on the Site URL homepage — which is exactly the "link takes me to the
site, nothing happens" bug. The frontend now also self-heals (it detects the
recovery session anywhere and routes to `/reset-password`), but the
allow-list makes the flow land on the right page directly.

## 4. Test

1. Log out → **Forgot password** → submit your email.
2. The email should arrive from `no-reply@rugbyleaguetakeover.com`, dark and
   branded, with an orange **Choose a new password** button.
3. The button should land on `/reset-password` showing the new-password form
   (not the homepage), and after submitting you're signed in at `/account`.
4. Register a fresh account with a second email — the confirmation code email
   should show the branded 6-digit code box.
