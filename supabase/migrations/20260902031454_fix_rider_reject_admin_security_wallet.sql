-- #1. Add 'rejected' to delivery status constraint + rejected_by_rider column
ALTER TABLE deliveries DROP CONSTRAINT IF EXISTS deliveries_status_check;
ALTER TABLE deliveries ADD CONSTRAINT deliveries_status_check
  CHECK (status = ANY (ARRAY['pending','assigned','picked_up','arriving','completed','cancelled','rejected']));

ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS rejected_by_riders uuid[] DEFAULT '{}';

-- #2. Admin security: ensure profiles.role check constraint already allows 'admin'
-- (verified: role = ANY (ARRAY['shop_owner','rider','admin']))
-- Add a policy so admin can read all deliveries, shops, riders, wallets for the admin dashboard
-- But shop_owners and riders can only see their own data (already enforced by existing policies)

-- Admin: read all deliveries
DROP POLICY IF EXISTS "deliveries_select_admin" ON deliveries;
CREATE POLICY "deliveries_select_admin" ON deliveries FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- Admin: read all shops
DROP POLICY IF EXISTS "shops_select_admin" ON shops;
CREATE POLICY "shops_select_admin" ON shops FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- Admin: read all riders
DROP POLICY IF EXISTS "riders_select_admin" ON riders;
CREATE POLICY "riders_select_admin" ON riders FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- Admin: read all wallets (for revenue overview)
DROP POLICY IF EXISTS "wallets_select_admin" ON wallets;
CREATE POLICY "wallets_select_admin" ON wallets FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- Admin: read all wallet_transactions
DROP POLICY IF EXISTS "wallet_tx_select_admin" ON wallet_transactions;
CREATE POLICY "wallet_tx_select_admin" ON wallet_transactions FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- #6. Wallet safety: revoke INSERT/UPDATE on wallets from authenticated users
-- so they can't directly add money. Only the system (service role) can modify balances.
-- Keep SELECT so users can view their balance.
REVOKE INSERT, UPDATE, DELETE ON wallets FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON wallet_transactions FROM authenticated;
