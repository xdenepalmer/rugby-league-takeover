#!/usr/bin/env bash
#
# Deploys the shop backend (real Stripe refunds + cancel + hardening).
#
#   ./scripts/deploy-shop-backend.sh
#
# Requires a Supabase access token in the environment (never paste it into a
# chat or commit it):
#
#   export SUPABASE_ACCESS_TOKEN=sbp_xxxxxxxx      # Account → Access Tokens
#
# The DB migration is applied separately — see DEPLOY_SHOP.md (SQL editor is the
# simplest path and needs no DB password).
#
# Safe to re-run: deploying a function just creates a new version.
set -euo pipefail

PROJECT_REF="ohytlrgfpcpvnqgdpqap"
cd "$(dirname "$0")/.."

if [ -z "${SUPABASE_ACCESS_TOKEN:-}" ]; then
  echo "ERROR: SUPABASE_ACCESS_TOKEN is not set."
  echo "  Create one at https://supabase.com/dashboard/account/tokens then:"
  echo "  export SUPABASE_ACCESS_TOKEN=sbp_xxxxxxxx"
  exit 1
fi

# Keep each function's bundled copy of shared.ts in sync with _shared/shared.ts.
echo "→ Syncing shared.ts into function directories…"
node scripts/sync-shared.mjs

# All four self-authenticate inside the function body, so platform JWT
# verification stays off:
#   stripeRefund / cancelOrder — getCaller() + an explicit role==='admin' check
#   createCheckout             — public guest checkout by design
#   stripeWebhook              — Stripe signs the request; it carries no JWT
FUNCTIONS=(stripeRefund cancelOrder createCheckout stripeWebhook)

for fn in "${FUNCTIONS[@]}"; do
  echo "→ Deploying $fn…"
  npx --yes supabase@2 functions deploy "$fn" \
    --project-ref "$PROJECT_REF" \
    --no-verify-jwt
done

echo
echo "✅ Functions deployed: ${FUNCTIONS[*]}"
echo
echo "NEXT: apply the database migration if you haven't yet —"
echo "  supabase/migrations/0010_store_refunds.sql  (see DEPLOY_SHOP.md)"
echo "Refunds will fail with a missing-column error until it is applied."
