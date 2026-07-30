-- Checkout totals include any GST/card fee configured to be charged on top.
-- The previous constraint compared total_aud only with merchandise, discount
-- and shipping, so every order with added GST failed before Stripe Checkout
-- could be created (SQLSTATE 23514).

alter table public.store_orders
  drop constraint if exists store_orders_promo_total_consistent;

alter table public.store_orders
  add constraint store_orders_promo_total_consistent
  check (
    merchandise_subtotal_aud is null
    or abs(
      total_aud
      - (
        merchandise_subtotal_aud
        - coalesce(discount_amount_aud, 0)
        + coalesce(shipping_cost_aud, 0)
        + case
            when coalesce(gst_included, false) then 0
            else coalesce(gst_amount_aud, 0)
          end
        + case
            when coalesce(card_fee_included, true) then 0
            else coalesce(card_fee_aud, 0)
          end
      )
    ) < 0.011
  ) not valid;

comment on constraint store_orders_promo_total_consistent
  on public.store_orders is
  'Charged total must equal merchandise less discount, plus shipping and any GST/card fee configured to be added.';
