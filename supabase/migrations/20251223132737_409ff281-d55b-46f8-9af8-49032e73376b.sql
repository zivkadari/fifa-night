-- Create join_attempts table for rate limiting
CREATE TABLE public.join_attempts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  attempted_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  success BOOLEAN NOT NULL DEFAULT false
);

-- Enable RLS
ALTER TABLE public.join_attempts ENABLE ROW LEVEL SECURITY;

-- Only allow the RPC function to insert (via SECURITY DEFINER)
CREATE POLICY "join_attempts: no direct access"
ON public.join_attempts FOR ALL
USING (false);

-- Index for quick rate limit lookups
CREATE INDEX idx_join_attempts_user_time 
ON public.join_attempts(user_id, attempted_at DESC);

-- Modify RPC to include rate limiting
CREATE OR REPLACE FUNCTION public.join_evening_by_code(_code TEXT)
RETURNS TABLE(evening_id TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  uid UUID;
  eid TEXT;
  recent_attempts INT;
BEGIN
  uid := auth.uid();
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  
  -- Check rate limit: max 10 attempts per hour
  SELECT COUNT(*) INTO recent_attempts
  FROM public.join_attempts
  WHERE user_id = uid 
  AND attempted_at > now() - interval '1 hour';
  
  IF recent_attempts >= 10 THEN
    RAISE EXCEPTION 'rate limit exceeded';
  END IF;
  
  -- Look up the evening
  SELECT id INTO eid FROM public.evenings WHERE share_code = upper(trim(_code));
  
  -- Log the attempt (success or failure)
  INSERT INTO public.join_attempts (user_id, success)
  VALUES (uid, eid IS NOT NULL);
  
  IF eid IS NULL THEN
    RAISE EXCEPTION 'invalid code';
  END IF;
  
  INSERT INTO public.evening_members (evening_id, user_id, role)
  VALUES (eid, uid, 'member')
  ON CONFLICT DO NOTHING;
  
  RETURN QUERY SELECT eid;
END;
$$;

-- Create cleanup function to remove old attempts (older than 24 hours)
CREATE OR REPLACE FUNCTION public.cleanup_old_join_attempts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  DELETE FROM public.join_attempts
  WHERE attempted_at < now() - interval '24 hours';
END;
$$;