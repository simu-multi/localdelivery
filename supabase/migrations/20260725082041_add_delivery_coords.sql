/*
# Add delivery location coordinates

Adds lat/lng columns to deliveries table to store the delivery destination coordinates
so they can be used for map display and live tracking.
*/

ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS delivery_lat float8;
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS delivery_lng float8;
