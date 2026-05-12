-- Create evening_members table for access control
CREATE TABLE IF NOT EXISTS public.evening_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evening_id text NOT NULL REFERENCES public.evenings(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner', 'member')),
  joined_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(evening_id, user_id)
);

-- Enable RLS on evening_members
ALTER TABLE public.evening_members ENABLE ROW LEVEL SECURITY;

-- Members can view their own memberships
CREATE POLICY "Members: users can view their own memberships"
ON public.evening_members
FOR SELECT
USING (user_id = auth.uid());

-- Public can insert (for joining evenings via RPC)
CREATE POLICY "Members: RPC can insert memberships"
ON public.evening_members
FOR INSERT
WITH CHECK (true);

-- No direct updates or deletes
CREATE POLICY "Members: no direct updates"
ON public.evening_members
FOR UPDATE
USING (false);

CREATE POLICY "Members: no direct deletes"
ON public.evening_members
FOR DELETE
USING (false);

-- Create trigger to automatically add owner as member when evening is created
CREATE OR REPLACE FUNCTION public.add_owner_to_evening_members()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.evening_members (evening_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'owner')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_add_owner_to_evening_members
AFTER INSERT ON public.evenings
FOR EACH ROW
EXECUTE FUNCTION public.add_owner_to_evening_members();

-- Now secure the evenings table by restricting visibility to members only
DROP POLICY IF EXISTS "Evenings: public read" ON public.evenings;

CREATE POLICY "Evenings: members can read"
ON public.evenings
FOR SELECT
USING (
  owner_id = auth.uid() 
  OR 
  EXISTS (
    SELECT 1 FROM public.evening_members 
    WHERE evening_id = evenings.id 
    AND user_id = auth.uid()
  )
);

-- Backfill existing evenings to add owners as members
INSERT INTO public.evening_members (evening_id, user_id, role)
SELECT id, owner_id, 'owner'
FROM public.evenings
ON CONFLICT DO NOTHING;
