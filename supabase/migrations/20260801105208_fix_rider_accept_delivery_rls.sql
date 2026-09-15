/*
# Fix rider accept delivery RLS policy

The existing deliveries_update_rider policy only allows updates where rider_id = auth.uid(),
but pending deliveries have rider_id = NULL, so riders cannot accept them.
This adds a policy allowing riders to update pending (unassigned) deliveries
to assign themselves, with a WITH CHECK ensuring they set rider_id to their own id.
*/

-- Drop the restrictive rider update policy and recreate with broader USING clause
DROP POLICY IF EXISTS deliveries_update_rider ON deliveries;
DROP POLICY IF EXISTS deliveries_update_rider_accept ON deliveries;

-- Allow riders to update deliveries they own OR pending deliveries they're accepting
CREATE POLICY "deliveries_update_rider" ON deliveries
  FOR UPDATE TO authenticated
  USING (
    rider_id = auth.uid()
    OR (rider_id IS NULL AND status = 'pending')
  )
  WITH CHECK (rider_id = auth.uid());
