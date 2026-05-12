-- =====================================================
-- Create a security definer function to get share_code
-- Only the evening owner can retrieve the share code
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_evening_share_code(_evening_id text)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  code text;
BEGIN
  SELECT share_code INTO code
  FROM public.evenings
  WHERE id = _evening_id AND owner_id = auth.uid();
  
  RETURN code;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_evening_share_code(text) TO authenticated;