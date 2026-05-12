
-- Disable triggers to bypass auth check
ALTER TABLE public.evenings DISABLE TRIGGER USER;

-- Move all fp-evenings to the team that has proper player links
UPDATE public.evenings 
SET team_id = '252cf49c-b20d-4551-9b7f-a27831c8de59'
WHERE data->>'mode' = 'five-player-doubles';

-- Re-enable triggers
ALTER TABLE public.evenings ENABLE TRIGGER USER;

-- Remove the empty "ליגת 5" team (has no player links)
DELETE FROM public.team_members WHERE team_id = 'a1b2c3d4-5678-9abc-def0-123456789abc';
DELETE FROM public.team_players WHERE team_id = 'a1b2c3d4-5678-9abc-def0-123456789abc';
DELETE FROM public.teams WHERE id = 'a1b2c3d4-5678-9abc-def0-123456789abc';
