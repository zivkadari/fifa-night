
REVOKE EXECUTE ON FUNCTION public.notify_team_join_request_created(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.notify_team_join_request_decision(uuid, boolean) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.notify_team_evening_started(text, uuid, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.notify_team_join_request_created(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.notify_team_join_request_decision(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.notify_team_evening_started(text, uuid, text) TO authenticated;
