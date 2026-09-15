/*
# Remove unused password_reset_otps table

The forgot-password flow uses Supabase's built-in signInWithOtp + verifyOtp
methods, which handle code generation and verification internally.
The custom password_reset_otps table is not needed.
*/

DROP TABLE IF EXISTS password_reset_otps;
