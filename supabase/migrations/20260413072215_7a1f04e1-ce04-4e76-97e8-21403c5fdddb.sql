
ALTER TABLE public.evenings DISABLE TRIGGER USER;

UPDATE public.evenings 
SET team_id = 'a1b2c3d4-5678-9abc-def0-123456789abc'
WHERE data->>'mode' = 'five-player-doubles' 
AND team_id IS NULL;

ALTER TABLE public.evenings ENABLE TRIGGER USER;
