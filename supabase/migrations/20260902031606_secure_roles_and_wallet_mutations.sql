-- Keep pending delivery rejection available without assigning the delivery.
DROP POLICY IF EXISTS "deliveries_update_rider" ON deliveries;
CREATE POLICY "deliveries_update_rider" ON deliveries FOR UPDATE
  TO authenticated
  USING ((rider_id = auth.uid()) OR ((rider_id IS NULL) AND (status = 'pending')))
  WITH CHECK ((rider_id = auth.uid()) OR ((rider_id IS NULL) AND (status = 'pending')));

-- Do not allow a user to promote their own profile to admin.
REVOKE INSERT, UPDATE ON profiles FROM authenticated;
GRANT UPDATE (full_name, mobile, avatar_url) ON profiles TO authenticated;

CREATE OR REPLACE FUNCTION create_user_profile(
  p_role text,
  p_full_name text,
  p_mobile text
) RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result public.profiles;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_role NOT IN ('shop_owner', 'rider') THEN
    RAISE EXCEPTION 'Invalid role';
  END IF;

  INSERT INTO public.profiles (id, role, full_name, mobile)
  VALUES (auth.uid(), p_role, COALESCE(p_full_name, ''), COALESCE(p_mobile, ''))
  RETURNING * INTO result;

  INSERT INTO public.wallets (profile_id, balance)
  VALUES (auth.uid(), 0);

  RETURN result;
END;
$$;
REVOKE EXECUTE ON FUNCTION create_user_profile(text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION create_user_profile(text, text, text) TO authenticated;

-- Wallet balances can only change through checked server functions.
CREATE OR REPLACE FUNCTION debit_wallet(
  p_wallet_id uuid,
  p_amount numeric,
  p_description text,
  p_delivery_id uuid DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  owner_id uuid;
  current_balance numeric;
BEGIN
  IF p_amount <= 0 OR p_amount > 100000 THEN
    RAISE EXCEPTION 'Invalid amount';
  END IF;
  SELECT profile_id, balance INTO owner_id, current_balance
  FROM public.wallets WHERE id = p_wallet_id FOR UPDATE;
  IF owner_id IS NULL OR owner_id <> auth.uid() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF current_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient wallet balance';
  END IF;
  UPDATE public.wallets SET balance = balance - p_amount, updated_at = now() WHERE id = p_wallet_id;
  INSERT INTO public.wallet_transactions (wallet_id, type, amount, description, delivery_id)
  VALUES (p_wallet_id, 'debit', p_amount, p_description, p_delivery_id);
  RETURN true;
END;
$$;
REVOKE EXECUTE ON FUNCTION debit_wallet(uuid, numeric, text, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION debit_wallet(uuid, numeric, text, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION credit_wallet(
  p_wallet_id uuid,
  p_amount numeric,
  p_description text,
  p_delivery_id uuid DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  owner_id uuid;
BEGIN
  IF p_amount <= 0 OR p_amount > 100000 THEN
    RAISE EXCEPTION 'Invalid amount';
  END IF;
  SELECT profile_id INTO owner_id FROM public.wallets WHERE id = p_wallet_id FOR UPDATE;
  IF owner_id IS NULL OR owner_id <> auth.uid() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  UPDATE public.wallets SET balance = balance + p_amount, updated_at = now() WHERE id = p_wallet_id;
  INSERT INTO public.wallet_transactions (wallet_id, type, amount, description, delivery_id)
  VALUES (p_wallet_id, 'credit', p_amount, p_description, p_delivery_id);
  RETURN true;
END;
$$;
REVOKE EXECUTE ON FUNCTION credit_wallet(uuid, numeric, text, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION credit_wallet(uuid, numeric, text, uuid) TO authenticated;
