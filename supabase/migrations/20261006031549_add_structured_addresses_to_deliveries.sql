/*
# Add structured address fields + pickup coordinates to deliveries

## Purpose
Store precise pickup and delivery addresses as structured JSON plus
exact latitude/longitude for both endpoints.

## Changes
1. Add pickup_lat, pickup_lng columns (NUMERIC, nullable)
2. Add pickup_address_structured (JSONB, nullable) and delivery_address_structured (JSONB, nullable)
3. Existing deliveries keep working — all new columns are nullable

## Security notes
- No RLS policy changes needed: these columns are on the existing
  deliveries table which already has per-row policies.
- JSONB columns store address components only — no sensitive data.
*/

ALTER TABLE deliveries
  ADD COLUMN IF NOT EXISTS pickup_lat NUMERIC,
  ADD COLUMN IF NOT EXISTS pickup_lng NUMERIC,
  ADD COLUMN IF NOT EXISTS pickup_address_structured JSONB,
  ADD COLUMN IF NOT EXISTS delivery_address_structured JSONB;
