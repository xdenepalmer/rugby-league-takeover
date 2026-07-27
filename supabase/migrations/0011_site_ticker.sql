-- Editable homepage scrolling ticker.
--
-- The Vegas marquee under the hero was a hardcoded array in src/pages/Home.jsx,
-- so changing it needed a code deploy. Store it as newline-separated lines
-- (one ticker item per line) — plain text keeps emoji support trivial and
-- avoids any JSON-parsing failure mode in the admin. NULL/empty falls back to
-- the built-in defaults, so an unset value never yields an empty banner.
alter table public.site_settings
  add column if not exists ticker_items text;
