-- Replace teams policies to avoid recursion and rely directly on owner_id and team_members
DROP POLICY IF EXISTS "Teams: admin delete only" ON public.teams;
DROP POLICY IF EXISTS "Teams: insert own or admin" ON public.teams;
DROP POLICY IF EXISTS "Teams: select owner, members, or admin" ON public.teams;
DROP POLICY IF EXISTS "Teams: update owner, members, or admin" ON public.teams;

CREATE POLICY "Teams: admin delete only"
ON public.teams
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Teams: insert own or admin"
ON public.teams
FOR INSERT
WITH CHECK ((owner_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Teams: select owner, members, or admin"
ON public.teams
FOR SELECT
USING (
  public.has_role(auth.uid(), 'admin')
  OR (owner_id = auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.team_members m
    WHERE m.team_id = teams.id AND m.user_id = auth.uid()
  )
);

CREATE POLICY "Teams: update owner, members, or admin"
ON public.teams
FOR UPDATE
USING (
  public.has_role(auth.uid(), 'admin')
  OR (owner_id = auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.team_members m
    WHERE m.team_id = teams.id AND m.user_id = auth.uid()
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR (owner_id = auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.team_members m
    WHERE m.team_id = teams.id AND m.user_id = auth.uid()
  )
);
