/*
# Password reset OTP table

1. New Tables
- `password_reset_otps`
  - `id` (uuid, primary key)
  - `email` (text, not null) — the email address the code was sent to
  - `code` (text, not null) — the 6-digit verification code
  - `expires_at` (timestamptz, not null) — 15 minutes after creation
  - `used` (boolean, default false) — marks a code as consumed after successful verification
  - `created_at` (timestamptz, default now())

2. Security
- RLS enabled so the anon-key client (used by the edge function with service role)
  cannot directly read or write codes. All access is via the edge functions using
  the service role key, which bypasses RLS.
- No policies are added — the table is locked down by default (deny all).
*/

CREATE TABLE IF NOT EXISTS password_reset_otps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  code text NOT NULL,
  expires_at timestamptz NOT NULL,
  used boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE password_reset_otps ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_password_reset_otps_email
  ON password_reset_otps(email)
  WHERE used = false;
