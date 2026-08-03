-- Collection passes for orders picked up at the Las Vegas event.
--
-- AusPost only ships within Australia, so every overseas order is collected in
-- person. Staff need something scannable at the stand, and the buyer needs it
-- somewhere they will actually find it on the day — their phone's wallet.
--
-- pass_serial is the scannable value. It is generated once and never rotates:
-- a wallet pass is stored on the device for months and cannot be re-signed each
-- time it is shown, so the barcode has to be stable. Redemption state is read
-- from THIS table at scan time, so a screenshotted or shared pass still fails
-- the second time it is presented.
alter table public.store_orders
  add column if not exists pass_serial text,
  add column if not exists pass_redeemed_at timestamptz,
  add column if not exists pass_redeemed_by text;

-- Unique so a scan resolves to exactly one order. Partial: only orders that
-- have actually been issued a pass take part.
create unique index if not exists store_orders_pass_serial_key
  on public.store_orders (pass_serial)
  where pass_serial is not null;

comment on column public.store_orders.pass_serial is
  'Stable scannable code for the collection pass. Never rotated — wallet passes cannot be re-signed on each display.';
comment on column public.store_orders.pass_redeemed_at is
  'Set when staff scan the pass at the event. Checked at scan time so a duplicated pass fails on second use.';
