
-- Create pairs_pool_config table for dynamic team pool distributions
CREATE TABLE public.pairs_pool_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wins_to_complete integer NOT NULL UNIQUE,
  distribution jsonb NOT NULL,
  include_prime boolean NOT NULL DEFAULT false,
  prime_count integer NOT NULL DEFAULT 0,
  updated_by uuid REFERENCES auth.users(id),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pairs_pool_config ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read
CREATE POLICY "pairs_pool_config: authenticated can read"
ON public.pairs_pool_config
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

-- Only clubs admin can insert
CREATE POLICY "pairs_pool_config: admin can insert"
ON public.pairs_pool_config
FOR INSERT
TO authenticated
WITH CHECK (public.is_clubs_admin(auth.uid()));

-- Only clubs admin can update
CREATE POLICY "pairs_pool_config: admin can update"
ON public.pairs_pool_config
FOR UPDATE
TO authenticated
USING (public.is_clubs_admin(auth.uid()));

-- Only clubs admin can delete
CREATE POLICY "pairs_pool_config: admin can delete"
ON public.pairs_pool_config
FOR DELETE
TO authenticated
USING (public.is_clubs_admin(auth.uid()));

-- Insert default configurations
INSERT INTO public.pairs_pool_config (wins_to_complete, distribution, include_prime, prime_count)
VALUES
  (4, '[{"stars": 5, "count": 2, "include_national": true}, {"stars": 4.5, "count": 3, "include_national": true}, {"stars": 4, "count": 2, "include_national": false}]'::jsonb, false, 0),
  (5, '[{"stars": 5, "count": 3, "include_national": true}, {"stars": 4.5, "count": 3, "include_national": true}, {"stars": 4, "count": 2, "include_national": false}]'::jsonb, true, 1),
  (6, '[{"stars": 5, "count": 3, "include_national": true}, {"stars": 4.5, "count": 4, "include_national": true}, {"stars": 4, "count": 4, "include_national": false}]'::jsonb, false, 0);
