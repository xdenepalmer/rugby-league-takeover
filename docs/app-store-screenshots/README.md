# App Store screenshots

Ready-to-upload marketing screenshots for the Rugby League Takeover iOS app,
generated from the real running app at exact App Store Connect resolutions.

## What's here

Five captioned screenshots, in the two iPhone sizes App Store Connect accepts:

| Folder | Resolution | App Store slot | Notes |
| --- | --- | --- | --- |
| `iphone-6.7/` | 1290 × 2796 | 6.7″ iPhone | The master set. Apple reuses these for every smaller iPhone automatically, so this size alone satisfies the iPhone requirement. |
| `iphone-6.5/` | 1242 × 2688 | 6.5″ iPhone | Same layout, provided for the older slot in case you'd rather upload it explicitly. |

The five panels, in order:

1. **The takeover, in your pocket** — home hero
2. **Plan your Vegas week** — travel, events & merch hub
3. **Shop the official drop** — merch store
4. **Join the fan forum** — community
5. **Synced everywhere** — account / sign-in

## How to upload

1. App Store Connect → your app → the version → **App Previews and Screenshots**.
2. Select the **6.7″ Display** size and drag in the five `iphone-6.7/*.png`
   files (they upload in filename order 01–05).
3. That's the only iPhone size you must provide — Apple scales it down for the
   6.5″/5.5″ slots. Upload `iphone-6.5/` too only if you prefer bespoke images
   there.
4. If you also ship on iPad, App Store Connect will ask for a 13″ iPad set —
   those aren't generated here (the app is iPhone-first); regenerate with an
   iPad viewport if needed.

## How they were generated

Captured from the live app with Playwright at true device resolution
(430 × 932 logical @3×), then composited into branded frames (brand gradient,
Oswald/Inter type, device bezel). The generator script lives in the session
scratchpad; to reproduce, capture the app pages and re-run the compositor.

> Note: product/news/gallery panels that read from Supabase show empty in a
> sandbox without live data — the five chosen panels are the ones that present
> fully without a populated database. Re-capture once the store has products
> loaded if you want a merch grid panel too.
