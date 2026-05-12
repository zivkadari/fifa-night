-- Profiles table and trigger
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='Profiles are viewable by everyone'
  ) THEN
    CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='Users can update their own profile'
  ) THEN
    CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='Users can insert their own profile'
  ) THEN
    CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
  END IF;
END$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_profile()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_update_profiles_updated_at') THEN
    CREATE TRIGGER trg_update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_profile();
  END IF;
END$$;

-- Create handle_new_user trigger to auto-create profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)), NULL)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created') THEN
    CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
  END IF;
END$$;

-- Evening membership and sharing
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'membership_role') THEN
    CREATE TYPE public.membership_role AS ENUM ('owner','member');
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS public.evening_members (
  evening_id text NOT NULL REFERENCES public.evenings(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.membership_role NOT NULL DEFAULT 'member',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (evening_id, user_id)
);

ALTER TABLE public.evening_members ENABLE ROW LEVEL SECURITY;

-- Allow users to read their memberships
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='evening_members' AND policyname='Users can view their memberships'
  ) THEN
    CREATE POLICY "Users can view their memberships" ON public.evening_members FOR SELECT TO authenticated USING (user_id = auth.uid());
  END IF;
END$$;

-- Add share_code to evenings and auto-membership trigger for owner
ALTER TABLE public.evenings ADD COLUMN IF NOT EXISTS share_code text UNIQUE NOT NULL DEFAULT substr(encode(gen_random_bytes(8),'hex'),1,10);

CREATE OR REPLACE FUNCTION public.add_owner_membership()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.evening_members (evening_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'owner')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_add_owner_membership') THEN
    CREATE TRIGGER trg_add_owner_membership
    AFTER INSERT ON public.evenings
    FOR EACH ROW EXECUTE FUNCTION public.add_owner_membership();
  END IF;
END$$;

-- Update evenings RLS to include members
DO $$
BEGIN
  -- Drop and recreate policies to include membership access
  PERFORM 1 FROM pg_policies WHERE schemaname='public' AND tablename='evenings' AND policyname='Select own or admin all';
  IF FOUND THEN DROP POLICY "Select own or admin all" ON public.evenings; END IF;
  PERFORM 1 FROM pg_policies WHERE schemaname='public' AND tablename='evenings' AND policyname='Insert own or admin';
  IF FOUND THEN DROP POLICY "Insert own or admin" ON public.evenings; END IF;
  PERFORM 1 FROM pg_policies WHERE schemaname='public' AND tablename='evenings' AND policyname='Update own or admin';
  IF FOUND THEN DROP POLICY "Update own or admin" ON public.evenings; END IF;
  PERFORM 1 FROM pg_policies WHERE schemaname='public' AND tablename='evenings' AND policyname='Admin delete only';
  IF FOUND THEN DROP POLICY "Admin delete only" ON public.evenings; END IF;

  CREATE POLICY "Select owner, members, or admin" ON public.evenings
  FOR SELECT TO authenticated
  USING (
    owner_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.evening_members m
      WHERE m.evening_id = evenings.id AND m.user_id = auth.uid()
    )
  );

  CREATE POLICY "Insert own or admin" ON public.evenings
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

  CREATE POLICY "Update owner, members, or admin" ON public.evenings
  FOR UPDATE TO authenticated
  USING (
    owner_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.evening_members m
      WHERE m.evening_id = evenings.id AND m.user_id = auth.uid()
    )
  )
  WITH CHECK (
    owner_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.evening_members m
      WHERE m.evening_id = evenings.id AND m.user_id = auth.uid()
    )
  );

  CREATE POLICY "Admin delete only" ON public.evenings
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
END$$;

-- Join-by-code function
CREATE OR REPLACE FUNCTION public.join_evening_by_code(_code text)
RETURNS TABLE(evening_id text)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid uuid;
  eid text;
BEGIN
  uid := auth.uid();
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  SELECT id INTO eid FROM public.evenings WHERE share_code = _code;
  IF eid IS NULL THEN
    RAISE EXCEPTION 'invalid code';
  END IF;
  INSERT INTO public.evening_members (evening_id, user_id, role)
  VALUES (eid, uid, 'member')
  ON CONFLICT DO NOTHING;
  RETURN QUERY SELECT eid;
END;
$$;