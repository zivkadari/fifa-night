-- Enable required extensions
create extension if not exists pgcrypto;

-- 1) Roles infrastructure
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);

-- RLS for user_roles: by default no one can modify via client; optionally allow users to read their own roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'user_roles' AND policyname = 'Users can view their own roles'
  ) THEN
    CREATE POLICY "Users can view their own roles" ON public.user_roles
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());
  END IF;
END$$;

-- Security definer function to check role membership (avoids recursive RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = _user_id AND ur.role = _role
  );
$$;

-- 2) Evenings table (secure storage for tournament evenings)
CREATE TABLE IF NOT EXISTS public.evenings (
  id text PRIMARY KEY,
  owner_id uuid NOT NULL,
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.evenings ENABLE ROW LEVEL SECURITY;

-- Update updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_update_evenings_updated_at'
  ) THEN
    CREATE TRIGGER trg_update_evenings_updated_at
    BEFORE UPDATE ON public.evenings
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END$$;

-- Policies: owner can CRUD except delete (admin-only); admins can select/update/insert/delete all
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'evenings' AND policyname = 'Select own or admin all'
  ) THEN
    CREATE POLICY "Select own or admin all" ON public.evenings
    FOR SELECT TO authenticated
    USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'evenings' AND policyname = 'Insert own or admin'
  ) THEN
    CREATE POLICY "Insert own or admin" ON public.evenings
    FOR INSERT TO authenticated
    WITH CHECK (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'evenings' AND policyname = 'Update own or admin'
  ) THEN
    CREATE POLICY "Update own or admin" ON public.evenings
    FOR UPDATE TO authenticated
    USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
    WITH CHECK (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'evenings' AND policyname = 'Admin delete only'
  ) THEN
    CREATE POLICY "Admin delete only" ON public.evenings
    FOR DELETE TO authenticated
    USING (public.has_role(auth.uid(), 'admin'));
  END IF;
END$$;

-- Helpful index for ordering by updated_at
CREATE INDEX IF NOT EXISTS idx_evenings_updated_at ON public.evenings (updated_at DESC);
