-- Public SELECT access for evenings
CREATE POLICY IF NOT EXISTS "Public can view all evenings"
ON public.evenings
FOR SELECT
USING (true);

-- Note: keep existing INSERT/UPDATE/DELETE policies unchanged