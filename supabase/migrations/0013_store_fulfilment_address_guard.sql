-- Prevent browser/admin fulfilment from marking an order shipped when Stripe
-- did not capture a usable Australian delivery address.

create or replace function public.protect_store_order_integrity()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if coalesce((select auth.role()), '') = 'service_role'
     or coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role' then
    return new;
  end if;

  if new.total_aud is distinct from old.total_aud
     or new.merchandise_subtotal_aud is distinct from old.merchandise_subtotal_aud
     or new.discount_amount_aud is distinct from old.discount_amount_aud
     or new.promo_code is distinct from old.promo_code
     or new.stripe_promotion_code_id is distinct from old.stripe_promotion_code_id
     or new.line_items is distinct from old.line_items
     or new.stripe_session_id is distinct from old.stripe_session_id
     or new.stripe_payment_intent_id is distinct from old.stripe_payment_intent_id
     or new.stripe_payment_status is distinct from old.stripe_payment_status
     or new.payment_verified_at is distinct from old.payment_verified_at
     or new.checkout_request_id is distinct from old.checkout_request_id
     or new.checkout_expires_at is distinct from old.checkout_expires_at
     or new.shipping_service_code is distinct from old.shipping_service_code
     or new.shipping_service_name is distinct from old.shipping_service_name
     or new.shipping_cost_aud is distinct from old.shipping_cost_aud
     or new.stripe_refund_id is distinct from old.stripe_refund_id
     or new.stripe_refund_status is distinct from old.stripe_refund_status
     or new.refund_amount is distinct from old.refund_amount
     or new.refund_reason is distinct from old.refund_reason
     or new.refunded_at is distinct from old.refunded_at then
    raise exception 'Payment and checkout fields are managed by Stripe workflows';
  end if;

  if new.status is distinct from old.status then
    if new.status in ('paid', 'refunded') then
      raise exception 'Use the Stripe payment/refund workflow for this status';
    end if;

    if not (
      (old.status = 'pending' and new.status = 'cancelled')
      or (old.status = 'paid' and new.status in ('packing', 'shipped'))
      or (old.status = 'packing' and new.status = 'shipped')
      or (old.status = 'shipped' and new.status = 'completed')
    ) then
      raise exception 'Invalid order status transition from % to %', old.status, new.status;
    end if;
  end if;

  if new.status in ('packing', 'shipped', 'completed') and old.payment_verified_at is null then
    raise exception 'Payment must be verified before fulfilment';
  end if;

  if new.status = 'shipped'
     and (coalesce(trim(new.tracking_number), '') = '' or coalesce(trim(new.carrier), '') = '') then
    raise exception 'Carrier and tracking number are required before shipping';
  end if;

  if new.status = 'shipped'
     and not (
       (
         coalesce(trim(new.shipping_address_line1), '') <> ''
         and coalesce(trim(new.shipping_suburb), '') <> ''
         and coalesce(trim(new.shipping_state), '') <> ''
         and coalesce(trim(new.shipping_postcode), '') <> ''
         and upper(coalesce(trim(new.shipping_country), '')) = 'AU'
       )
       or coalesce(trim(new.shipping_address), '') <> ''
     ) then
    raise exception 'A usable Australian shipping address is required before shipping';
  end if;

  return new;
end;
$$;

revoke execute on function public.protect_store_order_integrity()
  from anon, authenticated, public;
