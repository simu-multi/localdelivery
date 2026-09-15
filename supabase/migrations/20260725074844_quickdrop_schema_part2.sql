/*
# QuickDrop - Deliveries + wallet_transactions (Part 2)
Creates deliveries table, wallet_transactions, cross-table policies, and indexes.
*/

-- DELIVERIES
CREATE TABLE IF NOT EXISTS deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  rider_id uuid REFERENCES riders(id),
  customer_name text NOT NULL DEFAULT '',
  customer_mobile text NOT NULL DEFAULT '',
  pickup_address text NOT NULL DEFAULT '',
  delivery_address text NOT NULL DEFAULT '',
  parcel_description text NOT NULL DEFAULT '',
  notes text,
  distance_km float8 NOT NULL DEFAULT 0,
  charge numeric(10,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','assigned','picked_up','arriving','completed','cancelled')),
  otp text,
  otp_verified boolean NOT NULL DEFAULT false,
  assigned_at timestamptz,
  picked_up_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "deliveries_select_shop" ON deliveries;
CREATE POLICY "deliveries_select_shop" ON deliveries FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM shops WHERE shops.id = deliveries.shop_id AND shops.owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "deliveries_insert_shop" ON deliveries;
CREATE POLICY "deliveries_insert_shop" ON deliveries FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM shops WHERE shops.id = deliveries.shop_id AND shops.owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "deliveries_update_shop" ON deliveries;
CREATE POLICY "deliveries_update_shop" ON deliveries FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM shops WHERE shops.id = deliveries.shop_id AND shops.owner_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM shops WHERE shops.id = deliveries.shop_id AND shops.owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "deliveries_select_rider" ON deliveries;
CREATE POLICY "deliveries_select_rider" ON deliveries FOR SELECT
  TO authenticated USING (
    rider_id = auth.uid() OR status = 'pending'
  );

DROP POLICY IF EXISTS "deliveries_update_rider" ON deliveries;
CREATE POLICY "deliveries_update_rider" ON deliveries FOR UPDATE
  TO authenticated USING (
    rider_id = auth.uid()
  ) WITH CHECK (
    rider_id = auth.uid()
  );

-- WALLET TRANSACTIONS
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id uuid NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('credit','debit','recharge','withdrawal')),
  amount numeric(12,2) NOT NULL,
  description text NOT NULL DEFAULT '',
  delivery_id uuid REFERENCES deliveries(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wallet_tx_select_own" ON wallet_transactions;
CREATE POLICY "wallet_tx_select_own" ON wallet_transactions FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM wallets WHERE wallets.id = wallet_transactions.wallet_id AND wallets.profile_id = auth.uid())
  );

DROP POLICY IF EXISTS "wallet_tx_insert_own" ON wallet_transactions;
CREATE POLICY "wallet_tx_insert_own" ON wallet_transactions FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM wallets WHERE wallets.id = wallet_transactions.wallet_id AND wallets.profile_id = auth.uid())
  );

DROP POLICY IF EXISTS "wallet_tx_update_own" ON wallet_transactions;
CREATE POLICY "wallet_tx_update_own" ON wallet_transactions FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM wallets WHERE wallets.id = wallet_transactions.wallet_id AND wallets.profile_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM wallets WHERE wallets.id = wallet_transactions.wallet_id AND wallets.profile_id = auth.uid())
  );

DROP POLICY IF EXISTS "wallet_tx_delete_own" ON wallet_transactions;
CREATE POLICY "wallet_tx_delete_own" ON wallet_transactions FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM wallets WHERE wallets.id = wallet_transactions.wallet_id AND wallets.profile_id = auth.uid())
  );

-- Add riders cross-delivery select policy
DROP POLICY IF EXISTS "riders_select_for_delivery" ON riders;
CREATE POLICY "riders_select_for_delivery" ON riders FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM deliveries d
      JOIN shops s ON s.id = d.shop_id
      WHERE d.rider_id = riders.id AND s.owner_id = auth.uid()
    )
  );

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_deliveries_shop_id ON deliveries(shop_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_rider_id ON deliveries(rider_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_status ON deliveries(status);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_wallet_id ON wallet_transactions(wallet_id);
