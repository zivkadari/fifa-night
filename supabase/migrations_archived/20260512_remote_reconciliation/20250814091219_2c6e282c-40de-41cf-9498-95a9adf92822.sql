-- Add share_code to evenings table for evening sharing
ALTER TABLE public.evenings 
ADD COLUMN share_code TEXT UNIQUE;

-- Generate random share codes for existing evenings
UPDATE public.evenings 
SET share_code = upper(substr(md5(random()::text), 1, 6))
WHERE share_code IS NULL;

-- Create evening_members table for access control
CREATE TABLE public.evening_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  evening_id TEXT NOT NULL REFERENCES public.evenings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'member')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(evening_id, user_id)
);

-- Enable RLS
ALTER TABLE public.evening_members ENABLE ROW LEVEL SECURITY;

-- RLS policies for evening_members
CREATE POLICY "Users can view evening members if they are members themselves"
ON public.evening_members
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.evening_members em2
    WHERE em2.evening_id = evening_members.evening_id 
    AND em2.user_id = auth.uid()
  )
);

CREATE POLICY "Evening owners can manage members"
ON public.evening_members
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.evening_members em2
    WHERE em2.evening_id = evening_members.evening_id 
    AND em2.user_id = auth.uid()
    AND em2.role = 'owner'
  )
);

-- Update evenings RLS to allow members to view shared evenings
DROP POLICY IF EXISTS "Users can view their own evenings" ON public.evenings;
CREATE POLICY "Users can view their own evenings or evenings they are members of"
ON public.evenings
FOR SELECT
USING (
  owner_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.evening_members em
    WHERE em.evening_id = evenings.id 
    AND em.user_id = auth.uid()
  )
);

-- Update evenings policy for updates
DROP POLICY IF EXISTS "Users can update their own evenings" ON public.evenings;
CREATE POLICY "Users can update their own evenings or evenings they are members of"
ON public.evenings
FOR UPDATE
USING (
  owner_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.evening_members em
    WHERE em.evening_id = evenings.id 
    AND em.user_id = auth.uid()
  )
);

-- Function to join evening by code
CREATE OR REPLACE FUNCTION public.join_evening_by_code(_code TEXT)
RETURNS TABLE(evening_id TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  uid UUID;
  eid TEXT;
BEGIN
  uid := auth.uid();
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  
  SELECT id INTO eid FROM public.evenings WHERE share_code = _code;
  IF eid IS NULL THEN
    RAISE EXCEPTION 'invalid code';
  END IF;
  
  INSERT INTO public.evening_members (evening_id, user_id, role)
  VALUES (eid, uid, 'member')
  ON CONFLICT DO NOTHING;
  
  RETURN QUERY SELECT eid;
END;
$$;

-- Trigger to automatically add owner as member when evening is created
CREATE OR REPLACE FUNCTION public.add_owner_membership()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.evening_members (evening_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'owner')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER add_owner_membership_trigger
  AFTER INSERT ON public.evenings
  FOR EACH ROW EXECUTE FUNCTION public.add_owner_membership();