-- DISABLE RLS completely on holidays table
ALTER TABLE public.holidays DISABLE ROW LEVEL SECURITY;

-- Grant permissions just in case
GRANT ALL ON public.holidays TO postgres;
GRANT ALL ON public.holidays TO anon;
GRANT ALL ON public.holidays TO authenticated;
GRANT ALL ON public.holidays TO service_role;

-- Insert test data again just to be 100% sure
INSERT INTO public.holidays (holiday_date, name, scope)
SELECT '2025-12-25', 'Christmas Day (Test 2)', 'GLOBAL'
WHERE NOT EXISTS (
    SELECT 1 FROM public.holidays WHERE holiday_date = '2025-12-25'
);
