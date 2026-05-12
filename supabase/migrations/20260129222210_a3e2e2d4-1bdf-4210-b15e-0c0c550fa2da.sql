-- 1. Create security definer function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_clubs_admin(user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = user_id
    AND email = 'zivkad12@gmail.com'
  )
$$;

-- 2. Drop existing policies
DROP POLICY IF EXISTS "club_overrides: admin can insert" ON public.club_overrides;
DROP POLICY IF EXISTS "club_overrides: admin can update" ON public.club_overrides;
DROP POLICY IF EXISTS "club_overrides: admin can delete" ON public.club_overrides;

-- 3. Recreate policies using the new function
CREATE POLICY "club_overrides: admin can insert" 
ON public.club_overrides FOR INSERT 
WITH CHECK (public.is_clubs_admin(auth.uid()));

CREATE POLICY "club_overrides: admin can update" 
ON public.club_overrides FOR UPDATE 
USING (public.is_clubs_admin(auth.uid()));

CREATE POLICY "club_overrides: admin can delete" 
ON public.club_overrides FOR DELETE 
USING (public.is_clubs_admin(auth.uid()));