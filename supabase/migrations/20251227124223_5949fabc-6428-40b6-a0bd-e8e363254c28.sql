-- Create a database function that can be called to trigger a backfill
-- This function invokes the edge function with backfill_all = true
CREATE OR REPLACE FUNCTION public.trigger_stats_backfill()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- This is a placeholder that logs the intent
  -- The actual backfill should be triggered by calling the edge function
  RAISE NOTICE 'Stats backfill requested. Call the sync-stats edge function with backfill_all: true';
END;
$$;

-- Create a trigger function that will sync stats when an evening is updated
CREATE OR REPLACE FUNCTION public.notify_stats_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Log when evening data changes
  RAISE NOTICE 'Evening % updated, stats sync recommended', NEW.id;
  RETURN NEW;
END;
$$;

-- Create trigger on evenings table
DROP TRIGGER IF EXISTS evening_stats_sync_trigger ON public.evenings;
CREATE TRIGGER evening_stats_sync_trigger
  AFTER INSERT OR UPDATE OF data ON public.evenings
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_stats_sync();