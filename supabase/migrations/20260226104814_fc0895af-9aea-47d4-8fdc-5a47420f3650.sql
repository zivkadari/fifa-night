-- Add input validation to join_evening_by_code RPC
CREATE OR REPLACE FUNCTION public.join_evening_by_code(_code text)
 RETURNS TABLE(evening_id text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  uid UUID;
  eid TEXT;
  recent_attempts INT;
  cleaned_code TEXT;
BEGIN
  uid := auth.uid();
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  
  -- Validate and clean code
  cleaned_code := upper(trim(_code));
  
  IF length(cleaned_code) > 20 OR length(cleaned_code) = 0 THEN
    RAISE EXCEPTION 'invalid code format';
  END IF;
  
  IF cleaned_code !~ '^[A-Z0-9-]+$' THEN
    RAISE EXCEPTION 'invalid code format';
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
  SELECT id INTO eid FROM public.evenings WHERE share_code = cleaned_code;
  
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
$function$;