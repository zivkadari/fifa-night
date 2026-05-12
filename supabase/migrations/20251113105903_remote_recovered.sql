-- Drop tables that contain personal user information
-- These are no longer needed since the app works per-device without user authentication

DROP TABLE IF EXISTS public.evening_members CASCADE;
DROP TABLE IF EXISTS public.team_members CASCADE;
DROP TABLE IF EXISTS public.player_accounts CASCADE;
DROP TABLE IF EXISTS public.user_roles CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- Drop the enum types used by these tables
DROP TYPE IF EXISTS public.membership_role CASCADE;
DROP TYPE IF EXISTS public.app_role CASCADE;

-- Drop the security definer functions that are no longer needed
DROP FUNCTION IF EXISTS public.has_role(uuid, app_role) CASCADE;
DROP FUNCTION IF EXISTS public.is_team_owner(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.is_team_member(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.can_join_evening(text) CASCADE;
