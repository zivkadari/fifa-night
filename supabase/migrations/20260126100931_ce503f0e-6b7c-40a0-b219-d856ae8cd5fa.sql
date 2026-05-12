-- Drop the problematic triggers that use the non-SECURITY DEFINER function
DROP TRIGGER IF EXISTS trg_add_owner_membership ON public.evenings;
DROP TRIGGER IF EXISTS trg_evenings_add_owner_membership ON public.evenings;

-- Drop the old function that doesn't have SECURITY DEFINER
DROP FUNCTION IF EXISTS public.add_owner_membership();