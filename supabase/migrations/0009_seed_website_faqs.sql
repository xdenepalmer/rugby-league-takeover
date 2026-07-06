-- Seed the default "website" FAQs as real, editable rows.
--
-- Before this migration the public /faq page fell back to four FAQ questions
-- that were hard-coded in the React app (src/pages/Faq.jsx). They rendered on
-- the live site but had no database row, so they never appeared in
-- Admin -> Content -> FAQs and could not be edited, reordered or deleted.
--
-- Here we insert those same four questions as proper `category = 'general'`
-- rows so the admin owns them completely. Store FAQs (`category = 'store'`,
-- plus legacy rows with no category) are untouched and stay separate.
--
-- Idempotent: only seeds when the site has no 'general' FAQs yet, so existing
-- installs that already curated their website FAQs are left alone and re-runs
-- never create duplicates.

do $$
begin
  if not exists (select 1 from public.faqs where category = 'general') then
    insert into public.faqs (question, answer, category, sort_order, is_published) values
      (
        'What is Rugby League Takeover Las Vegas?',
        'Rugby League Takeover Las Vegas is a supporter hub for fans travelling to Las Vegas for rugby league week, with official updates, travel interest registration, event information, merch and community links.',
        'general', 1, true
      ),
      (
        'Where can I register interest for travel packages?',
        'Use the travel registration form on the homepage to tell us your preferred trip details, dates, hotel style and team support. The team can then follow up with relevant package information.',
        'general', 2, true
      ),
      (
        'Where do I find official event and ticket information?',
        'Event listings are available on the homepage in the Events section. Where official ticket or purchase links are available, they are shown directly on each event card and detail panel.',
        'general', 3, true
      ),
      (
        'How do I buy merchandise?',
        'Visit the Merch Shop, add items to your cart, enter your checkout details, and complete payment securely through Stripe from the published site.',
        'general', 4, true
      );
  end if;
end $$;
