-- Update RLS policy to allow members to update evenings
DROP POLICY IF EXISTS "Evenings: owner can update" ON public.evenings;

CREATE POLICY "Evenings: members can update"
ON public.evenings FOR UPDATE
USING (
  owner_id = auth.uid() 
  OR EXISTS (
    SELECT 1 FROM public.evening_members 
    WHERE evening_id = evenings.id AND user_id = auth.uid()
  )
);

-- Update the trigger function to allow members to update only the data column
CREATE OR REPLACE FUNCTION public.enforce_evenings_update_permissions()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid;
  is_owner boolean;
  is_member boolean;
BEGIN
  uid := auth.uid();
  is_owner := (uid IS NOT NULL AND OLD.owner_id = uid);
  is_member := EXISTS (
    SELECT 1 FROM public.evening_members m
    WHERE m.evening_id = OLD.id AND m.user_id = uid
  );

  -- Allow owner to change anything
  IF is_owner THEN
    RETURN NEW;
  END IF;

  -- Members can update ONLY the data column (scores, club selections)
  IF is_member THEN
    -- Block changes to sensitive fields
    IF (NEW.owner_id IS DISTINCT FROM OLD.owner_id)
       OR (NEW.team_id IS DISTINCT FROM OLD.team_id)
       OR (NEW.share_code IS DISTINCT FROM OLD.share_code)
    THEN
      RAISE EXCEPTION 'Members cannot modify owner, team, or share code';
    END IF;
    
    -- Allow data changes (scores, club selections)
    RETURN NEW;
  END IF;

  -- Non-members cannot update
  RAISE EXCEPTION 'Only the owner or members can modify evening records';
END;
$function$;