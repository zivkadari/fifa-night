
-- Step 1: Add team_id column (nullable for backfill)
ALTER TABLE public.player_accounts
ADD COLUMN team_id uuid;

-- Step 2: Backfill team_id from team_players
UPDATE public.player_accounts pa
SET team_id = (
  SELECT tp.team_id FROM public.team_players tp
  WHERE tp.player_id = pa.player_id
  LIMIT 1
);

-- Step 3: Drop old unique constraint on player_id (isOneToOne)
-- The existing constraint name from the FK is player_accounts_player_id_fkey
-- But the unique constraint may be named differently. Let's drop it safely.
ALTER TABLE public.player_accounts DROP CONSTRAINT IF EXISTS player_accounts_player_id_key;
ALTER TABLE public.player_accounts DROP CONSTRAINT IF EXISTS player_accounts_pkey;

-- Step 4: Add a proper PK and new constraints
ALTER TABLE public.player_accounts
ADD COLUMN id uuid NOT NULL DEFAULT gen_random_uuid();

ALTER TABLE public.player_accounts
ADD CONSTRAINT player_accounts_pkey PRIMARY KEY (id);

-- One user can only claim one player per team
ALTER TABLE public.player_accounts
ADD CONSTRAINT player_accounts_team_user_unique UNIQUE (team_id, user_id);

-- One player can only be claimed by one user per team
ALTER TABLE public.player_accounts
ADD CONSTRAINT player_accounts_team_player_unique UNIQUE (team_id, player_id);

-- Step 5: Update RLS policies
DROP POLICY IF EXISTS "PlayerAccounts: owner can read" ON public.player_accounts;
DROP POLICY IF EXISTS "PlayerAccounts: user can claim" ON public.player_accounts;
DROP POLICY IF EXISTS "PlayerAccounts: owner can delete" ON public.player_accounts;
DROP POLICY IF EXISTS "PlayerAccounts: no updates" ON public.player_accounts;

-- Users can read their own claims and claims of teammates
CREATE POLICY "PlayerAccounts: own and team reads"
ON public.player_accounts FOR SELECT
USING (
  user_id = auth.uid()
  OR (team_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.team_id = player_accounts.team_id AND tm.user_id = auth.uid()
  ))
);

-- Users can claim players in teams they belong to
CREATE POLICY "PlayerAccounts: team member can claim"
ON public.player_accounts FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  AND (
    team_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.team_id = player_accounts.team_id AND tm.user_id = auth.uid()
    )
  )
);

-- Users can unclaim their own
CREATE POLICY "PlayerAccounts: owner can delete"
ON public.player_accounts FOR DELETE
USING (user_id = auth.uid());

-- No direct updates
CREATE POLICY "PlayerAccounts: no updates"
ON public.player_accounts FOR UPDATE
USING (false);

-- Step 6: Update the sync trigger to use team_id
CREATE OR REPLACE FUNCTION public.sync_team_members_on_player_claim()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
BEGIN
  -- If team_id is set, sync membership for that specific team
  IF NEW.team_id IS NOT NULL THEN
    INSERT INTO public.team_members (team_id, user_id, role)
    VALUES (NEW.team_id, NEW.user_id, 'member')
    ON CONFLICT DO NOTHING;
  ELSE
    -- Fallback: sync all teams the player belongs to
    INSERT INTO public.team_members (team_id, user_id, role)
    SELECT tp.team_id, NEW.user_id, 'member'
    FROM public.team_players tp
    WHERE tp.player_id = NEW.player_id
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
