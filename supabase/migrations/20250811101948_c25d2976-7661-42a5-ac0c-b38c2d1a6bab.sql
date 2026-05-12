-- Public SELECT access for evenings (no IF NOT EXISTS)
CREATE POLICY "Public can view all evenings"
ON public.evenings
FOR SELECT
USING (true);