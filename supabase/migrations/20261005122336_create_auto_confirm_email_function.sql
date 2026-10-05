/*
# Auto-confirm user email after registration

## Purpose
Supabase has email confirmation enabled, which blocks new users from logging
in until they click a confirmation link. This app is designed for immediate
login after registration with no email verification step.

## Changes
1. Create a SECURITY DEFINER function `auto_confirm_user_email(p_email text)`
   that sets `email_confirmed_at = now()` for the user matching the email.
2. Grant execute to authenticated and anon roles so it can be called
   during the registration flow.

## Security notes
- The function runs as SECURITY DEFINER (owner privileges) to access auth.users.
- search_path is locked down to 'auth, public'.
- It only sets email_confirmed_at — no other fields are modified.
- This is intentional: the app has no email verification step.
*/

CREATE OR REPLACE FUNCTION public.auto_confirm_user_email(p_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
BEGIN
  UPDATE auth.users
  SET email_confirmed_at = now()
  WHERE email = p_email AND email_confirmed_at IS NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.auto_confirm_user_email(text) TO anon, authenticated;
