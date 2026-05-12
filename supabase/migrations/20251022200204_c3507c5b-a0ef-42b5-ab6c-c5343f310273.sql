-- Security Fix: Restrict evening members from updating data
-- Only owners and admins can modify evening data to prevent score manipulation
CREATE OR REPLACE FUNCTION public.enforce_evenings_update_permissions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid;
  is_owner boolean;
  is_admin boolean;
  is_member boolean;
BEGIN
  uid := auth.uid();
  is_owner := (uid IS NOT NULL AND OLD.owner_id = uid);
  is_admin := public.has_role(uid, 'admin');
  is_member := EXISTS (
    SELECT 1 FROM public.evening_members m
    WHERE m.evening_id = OLD.id AND m.user_id = uid
  );

  -- Allow owner/admin to change anything
  IF is_owner OR is_admin THEN
    RETURN NEW;
  END IF;

  -- Members can NO LONGER update data column (prevents score manipulation)
  -- They can only view via SELECT policy
  IF is_member THEN
    -- Members cannot modify any fields
    RAISE EXCEPTION 'Only the owner or admin can modify evening records';
  END IF;

  -- Protect sensitive columns from anyone else
  IF (NEW.owner_id IS DISTINCT FROM OLD.owner_id)
     OR (NEW.team_id IS DISTINCT FROM OLD.team_id)
     OR (NEW.share_code IS DISTINCT FROM OLD.share_code)
     OR (NEW.data IS DISTINCT FROM OLD.data)
  THEN
    RAISE EXCEPTION 'Only the owner or admin can modify owner_id, team_id, share_code, or data';
  END IF;

  RETURN NEW;
END;
$function$;

-- Security Fix: Validate display_name in handle_new_user
-- Prevent overly long or malicious display names
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  display_name_value text;
BEGIN
  -- Extract and validate display name from metadata
  display_name_value := COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1));
  
  -- Validate length (max 50 characters)
  IF length(display_name_value) > 50 THEN
    display_name_value := substring(display_name_value, 1, 50);
  END IF;
  
  -- Remove leading/trailing whitespace
  display_name_value := trim(display_name_value);
  
  -- Ensure not empty
  IF length(display_name_value) = 0 THEN
    display_name_value := split_part(NEW.email, '@', 1);
  END IF;
  
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (NEW.id, display_name_value, NULL)
  ON CONFLICT (id) DO NOTHING;
  
  RETURN NEW;
END;
$function$;