
CREATE OR REPLACE FUNCTION public.notify_team_admins_result_edited(
  _evening_id text,
  _title text,
  _body text,
  _data jsonb DEFAULT '{}'::jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  ev public.evenings%ROWTYPE;
  inserted_count int := 0;
  payload jsonb;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT * INTO ev FROM public.evenings WHERE id = _evening_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'evening not found';
  END IF;

  IF ev.team_id IS NULL THEN
    RETURN 0;
  END IF;

  -- Caller must be a member of the team
  IF NOT EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.team_id = ev.team_id AND tm.user_id = uid
  ) THEN
    RAISE EXCEPTION 'not a team member';
  END IF;

  payload := COALESCE(_data, '{}'::jsonb)
    || jsonb_build_object('evening_id', _evening_id, 'team_id', ev.team_id, 'editor_user_id', uid);

  INSERT INTO public.notifications (user_id, type, title, body, data)
  SELECT tm.user_id,
         'match_result_edited',
         COALESCE(NULLIF(_title, ''), 'תוצאה נערכה בטורניר'),
         _body,
         payload
  FROM public.team_members tm
  WHERE tm.team_id = ev.team_id
    AND tm.role IN ('owner', 'admin')
    AND tm.user_id <> uid;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.notify_team_admins_result_edited(text, text, text, jsonb) TO authenticated;
