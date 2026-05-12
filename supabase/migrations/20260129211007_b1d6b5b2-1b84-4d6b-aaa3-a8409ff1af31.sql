-- Create club_overrides table for admin star updates
CREATE TABLE public.club_overrides (
  club_id TEXT PRIMARY KEY,
  stars NUMERIC(2,1) NOT NULL CHECK (stars >= 0.5 AND stars <= 5),
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.club_overrides ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can read (so all users get updated stars)
CREATE POLICY "club_overrides: authenticated can read" 
ON public.club_overrides FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- Only admin (zivkad12@gmail.com) can insert
CREATE POLICY "club_overrides: admin can insert" 
ON public.club_overrides FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND email = 'zivkad12@gmail.com'
  )
);

-- Only admin can update
CREATE POLICY "club_overrides: admin can update" 
ON public.club_overrides FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND email = 'zivkad12@gmail.com'
  )
);

-- Only admin can delete
CREATE POLICY "club_overrides: admin can delete" 
ON public.club_overrides FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND email = 'zivkad12@gmail.com'
  )
);

-- Create trigger for updated_at
CREATE TRIGGER update_club_overrides_updated_at
BEFORE UPDATE ON public.club_overrides
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();