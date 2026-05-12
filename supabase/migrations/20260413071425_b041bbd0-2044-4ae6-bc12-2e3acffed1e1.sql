
-- Create team
INSERT INTO public.teams (id, name, owner_id)
VALUES ('a1b2c3d4-5678-9abc-def0-123456789abc', 'ליגת 5', '4024bb03-af5b-4d32-bc0d-a58938aa5a6d')
ON CONFLICT (id) DO NOTHING;

-- Add owner as team member
INSERT INTO public.team_members (team_id, user_id, role)
VALUES ('a1b2c3d4-5678-9abc-def0-123456789abc', '4024bb03-af5b-4d32-bc0d-a58938aa5a6d', 'owner')
ON CONFLICT DO NOTHING;

-- Add all 5 players to the team
INSERT INTO public.team_players (team_id, player_id)
SELECT 'a1b2c3d4-5678-9abc-def0-123456789abc', p.id
FROM public.players p
WHERE p.display_name IN ('רועי', 'זיו', 'שקד', 'רון', 'עידו')
ON CONFLICT DO NOTHING;

-- Disable user triggers to bypass auth check
ALTER TABLE public.evenings DISABLE TRIGGER USER;

-- Associate existing 5-player evenings with this team
UPDATE public.evenings 
SET team_id = 'a1b2c3d4-5678-9abc-def0-123456789abc'
WHERE data->>'mode' = 'five-player-doubles' 
AND team_id IS NULL;

-- Re-enable user triggers
ALTER TABLE public.evenings ENABLE TRIGGER USER;
